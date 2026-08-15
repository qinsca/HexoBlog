---
title: bfs&dfs模板
tags:
  - 算法
categories:
  - 算法
date: 2026.2.28
abbrlink: e7fb0c8
---
>复健来的
# bfs广度优先算法
## 模板

    // begin为起点，target为终点
    bool bfs(Node& begin,Node& target){
        queue<Node>Q;
        Node v_current,v_next;
        Node visit[]={false};
        Q.push(begin);
        while(!q.empty()){
            v_current=Q.front();
            Q.pop();
            visited[v_current]=true;
            //v_next为v_current通过某种一步变换得到
            while(valid[v_next]&&!visit[v_next]){
                if(v_next==target){
                    return true;
                }
                Q.push(v_next);
            }
        }
        return false;
    }
## 特点
* 最短路径：BFS适合解决最短路径问题，因为它按层次扩展，先到达的路径一定是最短的。
* 时间复杂度：O(V + E)，其中V为节点数，E为边数。
* 空间复杂度：O(V)，需要存储队列和访问记录。

# dfs深度优先算法
## 模板

    vector<int>visit;
    vector<int>route;
    void dfs(int cur,vector<int>& nums,int k){
        if(cur==k)return;
        for(int i=0;i<n;i++){
            if(!visit[num[i]]&&valid[num[i]]){
                route.push_back(num[i]);
                visit[num[i]]=true;
                dfs(cur+1,nums,k);
                visit[num[i]]=false;
                route.pop_back();
            }
        }
    }
## 特点
* 全路径搜索：DFS适合解决需要遍历所有可能路径的问题，如全排列、拓扑排序等。
* 时间复杂度：O(V + E)，与BFS相同。
* 空间复杂度：O(V)，递归调用栈的深度与节点数相关。

# 对比
* 搜索策略：BFS按层次搜索，DFS按深度搜索。
* 适用场景：BFS适合最短路径问题，DFS适合全路径搜索或需要深入探索的场景。
* 实现方式：BFS使用队列，DFS使用递归或显式栈。
* 性能差异：BFS在空间上可能占用更多内存，而DFS在深度较大时可能导致栈溢出