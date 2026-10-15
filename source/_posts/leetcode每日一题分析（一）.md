---
title: leetcode 每日一题回顾
tags:
  - 算法
categories:
  - 算法
date: 2026.9.28
abbrlink: b5c0499
---
# 题面

给你一个字符串 s 和一个*正整数* k 。
从字符串 s 中选出一组满足下述条件且*不重叠*的子字符串：
每个子字符串的长度*至少*为 k 。
每个子字符串是一个*回文串*。
返回最优方案中能选择的子字符串的*最大*数目。

*子字符串*是字符串中一个连续的字符序列。

# 示例

输入：s = "abaccdbbd", k = 3
输出：2
解释：可以选择 s = "*aba*cc*dbbd*" 中加粗的子字符串。"aba" 和 "dbbd" 都是回文，且长度至少为 k = 3 。
可以证明，无法选出两个以上的有效子字符串。

输入：s = "adbcda", k = 2
输出：0
解释：字符串中不存在长度至少为 2 的回文子字符串。

# 解析

这是一道动态规划题，对与前k个字符，有状态方程
dp[k]=dp[k-1]
dp[k]=max(dp[k],dp[j]+1),当字符串s[j][k-1]是回文子字符串时

于是自然要先对字符串进行预处理，我们可以发现，对于回文子字符串s[i][j]，如果字符s[i-1]=字符s[j+1],可以得出s[i-1][j+1]同样也是回文子字符串
同时，对于初始只有两个字符的子字符串，若两个字符相等则为回文子字符串
所以对字符串进行处理，用isP[i][j]来存储第i个字符到第j个字符之间的子字符串是不是回文字符串
有

```cpp
for(int len=1;len<=n;len++){
    for(int l=0;l+len<=n;l++){
        int r=l+len-1;
        isP[l][r]=s[l]==s[r]&&(len<=2||isP[l+1][r-1]);
    }
}
```

# 完整代码

```cpp
class Solution {
public:
    int maxPalindromes(string s, int k) {
        int n=s.size();
        vector<vector<bool>>isP(n,vector<bool>(n,0));
        for(int len =1;len<=n;len++){
            for(int l=0;l+len<=n;l++){
                int r=l+len-1;
                isP[l][r]=s[l]==s[r]&&(len<=2||isP[l+1][r-1]);
            }
        }
        vector<int>dp(n+1,0);
        for(int i=1;i<=n;i++){
            dp[i]=dp[i-1];
            for(int j=0;j+k<=i;j++){
                if(isP[j][i-1])dp[i]=max(dp[i],dp[j]+1);
            }
        }
        return dp[n];
    }
};
```

# 进阶 Manacher 算法

用 manacher 算法预处理后，可以用o（1）判断s的任何子字符串是否为回文串
Manacher 算法的精髓在于，通过利用已计算的对称回文字符串减少不必要的字符串比较
定义有
d1[i],对于索引为i的字符，d1[i]是以他为中心的回文字符串的半径（同理，会有d2[i]用于偶数长字符串，但可以通过操作去除）
[l,r]，算法维护的边界情况，l，r为当前r最大的回文子字符串的左右边界
对于i之前字符串都处理好的情况下，对于d1[i]，有三种情况：

* i>r i在最远的子字符串外部，只能向左右暴力扩展
* i<r i在最远的子字符串内部，根据对称，可以找到d1[l+r-i]，由此又分出两种情况

  * i+d1[l+r-i]<=r 那么完全在子字符串内部
  * i+d1[l+r-1]>r 那么只能从边界r处继续暴力扩展 此时d1[i]暂时先等于r-i+1

那么有 d1[] 迭代

```cpp
vector<int>d1(n);
for(int i=0,l=0,r=-1;i<n;i++){
    int k=(i>r)?1:min(d1[l+r-i],r-i+1);
    while(i-k>=0&&i+k<n&&s[i-k]==s[i+k])k++;
    d1[i]=k-1;
    if(i+k>r){
        l=i-k;
        r=i+k;
    }
}
```

对于d2同理，为了减少计算，可以将字符之间加入#，因此，对于 s 中一个以字母为中心的极大子回文串，设其长度为 m + 1 ，则其在变化后对应一个以相应字母为中心，长度为 2m+3 的极大子回文串；而对于 s 中一个以空为中心的极大子回文串，设其长度为 m，则其在变化后中对应一个以相应表示空的 # 为中心，长度为 2m + 1 的极大子回文串

```cpp
string t ="^";
for(char c:s){
    t+='#';
    t+=c;
}
t+='#&';
```

# 整合

```cpp
class Solution {
public:
    int maxPalindromes(string s, int k) {
        string t = "^";
        for (char c : s) {
            t += '#';
            t += c;
        }
        t += "#$";
        vector<int> half_len(t.size() - 2);
        half_len[1] = 1;

        int box_m = 0, box_r = 0;
        for (int i = 2; i < half_len.size(); i++) {
            int hl = 1;
            if (i < box_r) {
                hl = min(box_r - i, half_len[box_m * 2 - i]);
            }

            while (t[i - hl] == t[i + hl]) {
                hl++;
                box_m = i;
                box_r = i + hl;
            }

            half_len[i] = hl;
        }

        auto is_palindrome = [&](int l, int r) -> bool {
            return half_len[l + r + 2] > r - l + 1; 
        };

        int n = s.size();
        int ans = 0;
        for (int i = 0; i <= n - k;) {
            if (is_palindrome(i, i + k - 1)) {
                ans++;
                i += k; 
            } else if (i < n - k && is_palindrome(i, i + k)) {
                ans++;
                i += k + 1; 
            } else {
                i++;  
            }
        }
        return ans;
    }
};
```
