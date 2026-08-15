---
title: pwn学习记录（其六）
tags:
  - CTF
  - pwn
categories:
  - CTF
abbrlink: 20f999aa
date: 2025-11-26 00:00:00
---
# ret2csu
## 原理
一般而言，程序中会有一个控制参数很好用的gadgets，可以劫持rbx，rbp，r12，r13，r14，r15一级rdx，rsi，edi的值，同时可以调用指定的地址。在__libc_csu_init中（函数本用于初始化rbp）
## __libc_csu_init代码

    .text:00000000004005C0 ; void _libc_csu_init(void)
    .text:00000000004005C0                 public       __libc_csu_init
    .text:00000000004005C0 __libc_csu_init proc near               ; DATA XREF: _start+16o
    .text:00000000004005C0                 push    r15
    .text:00000000004005C2                 push    r14
    .text:00000000004005C4                 mov     r15d, edi
    .text:00000000004005C7                 push    r13
    .text:00000000004005C9                 push    r12
    .text:00000000004005CB                 lea     r12, __frame_dummy_init_array_entry
    .text:00000000004005D2                 push    rbp
    .text:00000000004005D3                 lea     rbp, __do_global_dtors_aux_fini_array_entry
    .text:00000000004005DA                 push    rbx
    .text:00000000004005DB                 mov     r14, rsi
    .text:00000000004005DE                 mov     r13, rdx
    .text:00000000004005E1                 sub     rbp, r12
    .text:00000000004005E4                 sub     rsp, 8
    .text:00000000004005E8                 sar     rbp, 3
    .text:00000000004005EC                 call    _init_proc
    .text:00000000004005F1                 test    rbp, rbp
    .text:00000000004005F4                 jz      short loc_400616
    .text:00000000004005F6                 xor     ebx, ebx
    .text:00000000004005F8                 nop     dword ptr [rax+rax+00000000h]
    .text:0000000000400600
    .text:0000000000400600  loc_400600:                             ; CODE XREF:     __libc_csu_init+54j
    .text:0000000000400600                 mov     rdx, r13
    .text:0000000000400603                 mov     rsi, r14
    .text:0000000000400606                 mov     edi, r15d
    .text:0000000000400609                 call    qword ptr [r12+rbx*8]
    .text:000000000040060D                 add     rbx, 1
    .text:0000000000400611                 cmp     rbx, rbp
    .text:0000000000400614                 jnz     short loc_400600
    .text:0000000000400616
    .text:0000000000400616 loc_400616:                             ; CODE XREF: __libc_csu_init+34j
    .text:0000000000400616                 add     rsp, 8
    .text:000000000040061A                 pop     rbx
    .text:000000000040061B                 pop     rbp
    .text:000000000040061C                 pop     r12
    .text:000000000040061E                 pop     r13
    .text:0000000000400620                 pop     r14
    .text:0000000000400622                 pop     r15
    .text:0000000000400624                 retn
    .text:0000000000400624 __libc_csu_init endp

从0x40061A开始，可以构造栈溢出来控制rbx,rbp,r12,r13,r14,r15寄存器中的数据
而0x400600到0x400614，可以将r13赋值给rdx，将r14赋值给rsi，r15赋值给rdi
从0x60060d到0x400614，可以控制rbx与rbp的关系为rbx+1=rbp，就不会执行loc_400614，而是执行下面的汇编程序
## 执行
所以可以构造ROP
```payload=flat([b'a'*offsets,rbx,rbp,r12,r13,r14,r15,return_addr])```
其中，rbx=0,rbp=1使函数不会跳转到loc_400614，而r12中放入想要跳转的地址，r13中是要赋给rdx的值，r14中是要赋给rsi的值，r15中是赋给edi的值，同时也可以控制rdi中低32位的地址
可以这样进行地址泄露或栈迁移
其实 libc_csu_init 的尾部通过偏移是可以控制其他寄存器的。其中，0x40061A 是正常的起始地址，可以看到我们在 0x40061f 处可以控制 rbp 寄存器，在 0x0400621 处可以控制 rsi 寄存器。