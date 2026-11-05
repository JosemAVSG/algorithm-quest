/**
 * Reference and naive solutions used to calibrate every `operationBudget`.
 *
 * Each pair is checked by `tests/unit/content/cost-calibration.test.ts`: the
 * reference passes within the mission's budget and the naive one does not. If a
 * mission's tests change size, the budget has to be re-measured, and this file
 * is how: run the reference and the naive solution with the step meter and pick
 * a budget between them (about three times the reference).
 */

export interface SolutionPair {
  ref: string;
  /** Absent when the mission has no meaningfully slower approach to compare against. */
  slow?: string;
  /** True when the naive solution is expected to compute a different (still valid) answer. */
  slowMayDiffer?: boolean;
}

export const CALIBRATION: Record<string, SolutionPair> = {
M10: { ref: `function findFirstDuplicateValue(ids){const s=new Set();for(let i=0;i<ids.length;i++){if(s.has(ids[i]))return ids[i];s.add(ids[i]);}return null;}`,
  slow: `function findFirstDuplicateValue(ids){for(let j=0;j<ids.length;j++){for(let i=0;i<j;i++){if(ids[i]===ids[j])return ids[j];}}return null;}` },
M11: { ref: `function mostFrequentCategory(orders){const m=new Map();for(const o of orders)m.set(o.category,(m.get(o.category)||0)+1);let best=null,bc=0;for(const [c,n] of m){if(n>bc||(n===bc&&c<best)){best=c;bc=n;}}return best;}`,
  slow: `function mostFrequentCategory(orders){let best=null,bc=0;for(let i=0;i<orders.length;i++){let n=0;for(let j=0;j<orders.length;j++){if(orders[j].category===orders[i].category)n++;}const c=orders[i].category;if(n>bc||(n===bc&&c<best)){best=c;bc=n;}}return best;}` },
M12: { ref: `function buildAuditReport(orders){const count=new Map(),cats=new Map();let bestId=null,bp=-Infinity;for(let i=0;i<orders.length;i++){const o=orders[i];count.set(o.id,(count.get(o.id)||0)+1);cats.set(o.category,(cats.get(o.category)||0)+1);if(o.priority>bp){bp=o.priority;bestId=o.id;}}const dup=[];for(const [id,n] of count){if(n>=2)dup.push(id);}return {duplicateIds:dup,categoryCounts:[...cats],highestPriorityOrderId:bestId};}` },
M13: { ref: `function findMatchingPair(sizes,target){const seen=new Map();for(let j=0;j<sizes.length;j++){const f=target-sizes[j];if(seen.has(f))return [seen.get(f),j];if(!seen.has(sizes[j]))seen.set(sizes[j],j);}return null;}`,
  slow: `function findMatchingPair(sizes,target){for(let j=0;j<sizes.length;j++){for(let i=0;i<j;i++){if(sizes[i]+sizes[j]===target)return [i,j];}}return null;}` },
M14: { ref: `function groupByZone(items){const m=new Map();for(const it of items){if(!m.has(it.zone))m.set(it.zone,[]);m.get(it.zone).push(it.sku);}return Object.fromEntries(m);}`,
  slow: `function groupByZone(items){const zones=[];for(const it of items){if(!zones.includes(it.zone))zones.push(it.zone);}const out={};for(const z of zones){out[z]=items.filter((x)=>x.zone===z).map((x)=>x.sku);}return out;}` },
M15: { ref: `function codesAtLeast(codes,minCount){const m=new Map();for(const c of codes)m.set(c,(m.get(c)||0)+1);const out=[];for(const [c,n] of m){if(n>=minCount)out.push(c);}return out;}`,
  slow: `function codesAtLeast(codes,minCount){const out=[];for(const c of codes){const n=codes.filter((x)=>x===c).length;if(n>=minCount&&!out.includes(c))out.push(c);}return out;}` },
M16: { ref: `function duplicateRecords(records){const g=new Map();for(const r of records){const k=r.email.trim().toLowerCase()+'|'+r.branch.trim().toLowerCase();if(!g.has(k))g.set(k,[]);g.get(k).push(r.id);}return [...g.values()].filter((x)=>x.length>=2);}`,
  slow: `function duplicateRecords(records){const key=(r)=>r.email.trim().toLowerCase()+'|'+r.branch.trim().toLowerCase();const used=[];const out=[];for(let i=0;i<records.length;i++){if(used.includes(i))continue;const grp=[records[i].id];for(let j=i+1;j<records.length;j++){if(key(records[i])===key(records[j])){grp.push(records[j].id);used.push(j);}}if(grp.length>=2)out.push(grp);}return out;}` },
M18: { ref: `function joinSortedLists(a,b){const o=[];let i=0,j=0;while(i<a.length&&j<b.length)o.push(a[i]<=b[j]?a[i++]:b[j++]);while(i<a.length)o.push(a[i++]);while(j<b.length)o.push(b[j++]);return o;}`,
  slow: `function joinSortedLists(a,b){const o=a.slice();for(const x of b){let p=0;while(p<o.length&&o[p]<=x)p++;o.splice(p,0,x);}return o;}` },
M19: { ref: `function bestStreak(v,k){if(k<1||k>v.length)return null;let s=0;for(let i=0;i<k;i++)s+=v[i];let b=s;for(let i=k;i<v.length;i++){s+=v[i]-v[i-k];if(s>b)b=s;}return b;}`,
  slow: `function bestStreak(v,k){if(k<1||k>v.length)return null;let b=-Infinity;for(let i=0;i+k<=v.length;i++){let s=0;for(let j=i;j<i+k;j++)s+=v[j];if(s>b)b=s;}return b;}` },
M20: { ref: `function attendOrder(t){return [...t].sort((a,b)=>b.priority-a.priority||a.arrived-b.arrived).map((x)=>x.id);}`,
  slow: `function attendOrder(t){const rest=[...t];const out=[];while(rest.length){let bi=0;for(let i=1;i<rest.length;i++){const a=rest[i],b=rest[bi];if(a.priority>b.priority||(a.priority===b.priority&&a.arrived<b.arrived))bi=i;}out.push(rest[bi].id);rest.splice(bi,1);}return out;}` },
M21: { ref: `function firstValidBatch(d,x){let lo=0,hi=d.length;while(lo<hi){const m=(lo+hi)>>1;if(d[m]<x)lo=m+1;else hi=m;}return lo;}`,
  slow: `function firstValidBatch(d,x){for(let i=0;i<d.length;i++){if(d[i]>=x)return i;}return d.length;}` },
M23: { ref: `function isWellClosed(text){const p={')':'(',']':'[','}':'{'};const st=[];for(const c of text){if(c==='('||c==='['||c==='{')st.push(c);else if(p[c]!==undefined){if(st.pop()!==p[c])return false;}}return st.length===0;}` },
M24: { ref: `function runDesk(events){const w=[],s=[];let h=0;for(const e of events){if(e.type==='arrive')w.push(e.name);else if(h<w.length)s.push(w[h++]);}return {served:s,waiting:w.slice(h)};}`,
  slow: `function runDesk(events){const w=[],s=[];for(const e of events){if(e.type==='arrive')w.push(e.name);else if(w.length)s.push(w.shift());}return {served:s,waiting:w};}` },
M30: { ref: `function fewestStops(nb,s,g){const d=new Map([[s,0]]);const q=[s];let h=0;while(h<q.length){const c=q[h++];if(c===g)return d.get(c);for(const x of nb[c])if(!d.has(x)){d.set(x,d.get(c)+1);q.push(x);}}return -1;}`,
  slow: `function fewestStops(nb,s,g){const seen=[s];const dist=[0];const q=[s];while(q.length){const c=q.shift();const dc=dist[seen.indexOf(c)];if(c===g)return dc;for(const x of nb[c])if(!seen.includes(x)){seen.push(x);dist.push(dc+1);q.push(x);}}return -1;}` },
M32: { ref: `function hasCircle(needs){const st=needs.map(()=>0);function f(u){st[u]=1;for(const v of needs[u]){if(st[v]===1)return true;if(st[v]===0&&f(v))return true;}st[u]=2;return false;}for(let u=0;u<needs.length;u++)if(st[u]===0&&f(u))return true;return false;}`,
  slow: `function hasCircle(needs){function f(u,path){for(const v of needs[u]){if(path.includes(v))return true;if(f(v,[...path,v]))return true;}return false;}for(let u=0;u<needs.length;u++)if(f(u,[u]))return true;return false;}` },
M33: { ref: `function waysToFill(p,t){const out=[],cur=[];function go(i,s){if(i===p.length){if(s===t)out.push([...cur]);return;}cur.push(p[i]);go(i+1,s+p[i]);cur.pop();go(i+1,s);}go(0,0);return out;}` },
M34: { ref: `function missingBox(a){const n=a.length;let m=(n*(n+1))/2;for(let i=0;i<n;i++)m-=a[i];return m;}`,
  slow: `function missingBox(a){for(let i=0;i<=a.length;i++){if(!a.includes(i))return i;}}` },
M35: { ref: `function daysUntilHigher(t){const o=t.map(()=>0);const st=[];for(let i=0;i<t.length;i++){while(st.length&&t[i]>t[st[st.length-1]]){const j=st.pop();o[j]=i-j;}st.push(i);}return o;}`,
  slow: `function daysUntilHigher(t){const o=[];for(let i=0;i<t.length;i++){let d=0;for(let j=i+1;j<t.length;j++){if(t[j]>t[i]){d=j-i;break;}}o.push(d);}return o;}` },
M36: { ref: `function ways(n){const f=[1];for(let i=1;i<=n;i++){f[i]=f[i-1];if(i>=2)f[i]+=f[i-2];if(i>=3)f[i]+=f[i-3];}return f[n];}`,
  slow: `function ways(n){if(n<0)return 0;if(n===0)return 1;return ways(n-1)+ways(n-2)+ways(n-3);}` },
M37: { slowMayDiffer: true, ref: `function planOrder(tasks){const need=new Map(tasks.map((x)=>[x.name,x.needs.length]));const users=new Map(tasks.map((x)=>[x.name,[]]));for(const x of tasks)for(const d of x.needs)users.get(d).push(x.name);const q=tasks.filter((x)=>x.needs.length===0).map((x)=>x.name);const order=[];for(let h=0;h<q.length;h++){const c=q[h];order.push(c);for(const u of users.get(c)){need.set(u,need.get(u)-1);if(need.get(u)===0)q.push(u);}}return order.length===tasks.length?order:null;}`,
  slow: `function planOrder(tasks){const done=[];let moved=true;while(moved){moved=false;for(const x of tasks){if(!done.includes(x.name)&&x.needs.every((d)=>done.includes(d))){done.push(x.name);moved=true;}}}return done.length===tasks.length?done:null;}` },
M39: { ref: `function arrangeBySplitting(v){if(v.length<2)return [...v];const [p,...r]=v;return [...arrangeBySplitting(r.filter((x)=>x<=p)),p,...arrangeBySplitting(r.filter((x)=>x>p))];}`,
  slow: `function arrangeBySplitting(w){const r=[...w];const o=[];while(r.length){let m=0;for(let i=1;i<r.length;i++){if(r[i]<r[m])m=i;}o.push(r[m]);r.splice(m,1);}return o;}` },
M41: { ref: `function cheapestRoute(roads,start,goal){const n=roads.length;const d=roads.map(()=>Infinity);const done=roads.map(()=>false);d[start]=0;for(let k=0;k<n;k++){let u=-1;for(let i=0;i<n;i++){if(!done[i]&&d[i]<Infinity&&(u===-1||d[i]<d[u]))u=i;}if(u===-1)break;done[u]=true;for(const [v,c] of roads[u]){if(d[u]+c<d[v])d[v]=d[u]+c;}}return d[goal]===Infinity?-1:d[goal];}`,
  slow: `function cheapestRoute(roads,start,goal){let best=Infinity;function go(u,cost,seen){if(cost>=best)return;if(u===goal){best=cost;return;}for(const [v,c] of roads[u]){if(!seen.includes(v))go(v,cost+c,[...seen,v]);}}go(start,0,[start]);return best===Infinity?-1:best;}` },
};

