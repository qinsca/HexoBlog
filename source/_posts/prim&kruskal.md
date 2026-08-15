---
title: prim&kruskal 最小生成树 & 并查集
tags:
  - 算法
categories:
  - 算法
date: 2026.3.1
abbrlink: 8767c317
---
# prim
选出离当前生成树最近的点加入生成树

    const int max=10000,INF=0x3f3f3f3f;
    int g[max][max],dist[max],n,m,res;
    //g[][]保存边的权重，dist保存点到当前生成树的距离，res保存结果
    bool book[max];
    //book保存当前点的使用情况

    //首先初始化g[][]，dist[]为INF，记录存在边的权重

    void prim(){
        dist[1]=0;
        book[1]=true;
        for(int i=2;i<=n;i++)dist[i]=min(dist[i],g[1][i]);
        
        for(int i=2;i<=n;i++){
            int temp=INF;
            int t=-1;
            for(int j=2;j<=n;j++){
                if(!book[j]&&dist[j]<temp){
                    t=j;
                    temp=dist[j];
                }
            }
            if(t==-1){
                res=-1;
                return;
            }
            book[t]=true;
            res+=dist[t];
            for(int j=2;j<=n;j++)dist[j]=min(dist[j],g[j][t]);
        }
    }

# 并查集

    //初始化
    int fa[max],rank[max];
    for(int i=1;i<max;i++){
        fa[i]=i;
        rank[i]=1;//通过深度来决定合并的方向
    }
    //查找+路径压缩
    int find(int x){
        return x==fa[x]?x:(fa[x]=find(fa[x]))
    }
    //合并
    void merge(int i,int j){
        int x=find[i],y=find[j];
        if(rank[x]<=rand[y])fa[x]=y;
        else fa[y]=x;
        if(rank[x]==rank[y]&&x!=y){
            rank[y]++;
        }
    }

# kruskal 
将所有的边按照他们的边权由小到大排序，然后进行一次遍历，枚举每一条边，如果边所连的两个点还没有被联通，就选取这条边来构造最小生成树，如果连通过，就不管了，继续枚举下一条边，直到枚举完成，所有选用的边就构成了最小生成树。

    //初始化
    
    int n,cnt,res,m;//n为点的个数，cnt为已选的边数，res为已选边权和，m为边的数量
    int fa[max];
    for(int i=1;i<=n;i++)fa[i]=i;
    struct edge{
        int w;//边权
        int ptr1,ptr2;//边的两点
    }
    edge len[100];
    bool cmp(edge len1,edge len2){
        return len1.w<len2.w;
    }
    int find(int x){
        return x==fa[x]?x:(fa[x]=find(fa[x]));
    }
    void build(int x){
        res+=len[x].w;
        fa[find(x.ptr1)]=find(x.ptr2);
    }
    //录入存在的点，边
    sort(len+1,len+m+1,cmp);
    for(int i=1;i<=m;i++){
        if(cnt==n-1)break;
        if(find(len[i].ptr1)!=find(len[i].ptr2)){
            cnt++;
            build(i);
        }
    }

