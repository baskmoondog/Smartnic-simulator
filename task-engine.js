const Lab = (() => {
 const hash = s => [...s].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,0)%8;
 function create(packet,rules,task) { return {packet:{...packet},rules:rules.map((r,i)=>({...r,id:i+1,hits:0})),task,rx:[],tx:[],buckets:Array.from({length:8},()=>[]),counts:{received:0,forwarded:0,dropped:0,cpu:0,bytes:0},step:0,match:null,result:'待处理',log:'准备接收报文'}; }
 function next(s) {
  const p=s.packet, key=`${p.src}|${p.dst}|${p.proto}|${p.sport}|${p.dport}`;
  switch(s.step) {
   case 0:s.rx.push({...p});s.counts.received++;s.log='MAC 接收报文，写入 SRAM 接收队列。';break;
   case 1:s.rx.shift();s.log='P4 解析器从接收队列取出报文并解析五元组。';break;
   case 2:if(s.task==='统计') {let b=hash(key),e=s.buckets[b].find(x=>x.key===key);if(!e){e={key,packets:0,bytes:0};s.buckets[b].push(e)}s.match=e;s.log=`哈希引擎计算桶 ${b}，逐项比较五元组${e.packets?'，找到已有流':'，建立流记录'}。`;} else {s.match=s.rules.filter(r=>(r.proto==='ANY'||r.proto===p.proto)&&(r.dport===''||Number(r.dport)===p.dport)).sort((a,b)=>b.priority-a.priority)[0]||null;s.log=s.match?`TCAM 按优先级匹配到规则 #${s.match.id}。`:'TCAM 未命中，交由控制面处理。';}break;
   case 3:if(s.task==='统计'){s.match.packets++;s.match.bytes+=p.size;s.counts.bytes+=p.size;s.result='转发';s.log='计数器更新该流的包数和字节数。';}else if(s.match){s.match.hits++;s.result=s.match.action;s.log=`P4 动作执行：${s.result}；规则命中计数加一。`;}else{s.result='上送CPU';s.log='未命中：经 PCIe 上送 CPU，本实验不自动建表。';}break;
   case 4:if(s.result==='转发'){s.tx.push({...p});s.log='报文进入 SRAM 发送队列。';}else {s.counts[s.result==='丢弃'?'dropped':'cpu']++;s.log=s.result==='丢弃'?'丢弃报文，不进入发送队列。':'CPU 接收报文，不进入发送队列。';}break;
   case 5:if(s.result==='转发'){s.tx.shift();s.counts.forwarded++;s.log='MAC 从发送队列取出报文并发送。';}else s.log='处理结束，发送阶段跳过。';break;
   default:return false;
  }s.step++;return true;
 }
 function snapshot(s) {
  const copy=JSON.parse(JSON.stringify(s));
  if (s.match && s.task==='统计') copy.match=copy.buckets.flat().find(e=>e.key===s.match.key) || null;
  else if (s.match) copy.match=copy.rules.find(r=>r.id===s.match.id) || null;
  return copy;
 }
 return {create,next,hash,snapshot};
})();
if(typeof module!=='undefined') module.exports=Lab;
