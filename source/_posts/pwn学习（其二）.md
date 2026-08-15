---
title: pwn学习记录（其二）
tags:
  - CTF
  - pwn
date: 2025-11-5
categories:
  - CTF
abbrlink: d05aad03
---
# 函数传参
## 函数调用约定
**_cdecl**：c/c++默认方式，参数从右入左，主调函数负责栈平衡
_stdcall：windows API默认方式，参数从右向左入栈，被调函数负责栈平衡
_fastcall：快速调用。参数优先从寄存器存入（ECX和EDX），剩下的参数再从右向左从栈传入。存取方式快于内存

# _cdecl:c语言调用栈
- x86
    - 用栈来传递函数
    - 使用eax存放返回值
- amd64
    - 前六个参数依次存放于rdi，rsi，rdx，rcx，r8，r9寄存器中
    - 第七个以后的参数存放于栈中

# ret2text64位传参ROP基础
如果程序中没有存在代码：

    mov eax,0xb
    mov ebx,["/bin.sh"]
    mov ecx,0
    mov edx,0
    int 0x80
    //即为execve("bin/sh",NULL,NULL)

则需要考虑ROP(Return Oriented Programming)返回导向编程
对于能控制RIP的指令有
* JMP
* pop RIP
* ret
* call =push rip，jmp
## 指令集拆分
对于寄存器rbp，r12，rbp对应5D，r12对应41 5D，如果返回指令时跳过41，就能将``pop r12``为``pop rbp``
## ROPgadget
命令``ROPgadget --binary a.out``和``ropper -f a.out``能找到可用的gadget
# ret2text进阶
当读取长度有限时，可参考pwn学习（一）的最后，直接跳到调用函数执行call的地方，使指令简便