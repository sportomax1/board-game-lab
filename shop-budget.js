/* Board Game Lab — Shop budget planner. Uses existing shop.html data and BGG interest scores. */
window.ShopBudget = (() => {
  'use strict';
  let current = null;

  function utility(game,mode){
    const markdown=Math.max(0,Math.min(1,(game.off||0)/100));
    const multiplier=mode==='interest'?1:mode==='markdown'?1+1.5*markdown:1+0.5*markdown;
    return Math.round(game.interestScore*1000*multiplier);
  }
  function uniqueGames(games){
    const map=new Map();
    for(const game of games){
      const key=String(game.id||norm(game.game));
      const old=map.get(key);
      if(!old||game.sale<old.sale||(game.sale===old.sale&&game.off>old.off))map.set(key,game);
    }
    return [...map.values()];
  }
  function optimize(games,budgetCents,mode){
    const cap=Math.max(0,Math.floor(budgetCents));
    if(!cap)return {items:[],spent:0,points:0,utility:0,saved:0};
    const values=new Float64Array(cap+1).fill(-1);
    const points=new Int32Array(cap+1),saved=new Int32Array(cap+1),pointers=new Array(cap+1);
    values[0]=0;
    for(const game of uniqueGames(games)){
      const cost=Math.round(game.sale*100);
      if(cost<1||cost>cap||!(game.interestScore>0))continue;
      const gain=utility(game,mode),discount=Math.max(0,Math.round((game.full-game.sale)*100));
      // Descending positions ensure each game is used at most once.
      for(let amount=cap;amount>=cost;amount--){
        const prior=amount-cost;
        if(values[prior]<0)continue;
        const score=values[prior]+gain,pointTotal=points[prior]+game.interestScore,discountTotal=saved[prior]+discount;
        if(score>values[amount]||(score===values[amount]&&(pointTotal>points[amount]||(pointTotal===points[amount]&&discountTotal>saved[amount])))){
          values[amount]=score;points[amount]=pointTotal;saved[amount]=discountTotal;
          pointers[amount]={game,previous:pointers[prior]};
        }
      }
    }
    let winner=0;
    for(let amount=1;amount<=cap;amount++){
      if(values[amount]<0)continue;
      if(values[amount]>values[winner]||(values[amount]===values[winner]&&(
        points[amount]>points[winner]||(points[amount]===points[winner]&&amount<winner)
      )))winner=amount;
    }
    const items=[];
    for(let node=pointers[winner];node;node=node.previous)items.push(node.game);
    items.sort((a,b)=>b.interestScore-a.interestScore||a.sale-b.sale);
    return {items,spent:winner,points:points[winner],utility:values[winner],saved:saved[winner]};
  }
  function bestBasket(games,cents,mode,scope,seller){
    const filtered=seller?games.filter(g=>g.seller===seller):games;
    if(scope==='mixed'||seller){
      return {...optimize(filtered,cents,mode),seller:seller||'Mixed stores',mixed:!seller&&scope==='mixed',alternatives:[]};
    }
    const byStore=new Map();
    for(const game of filtered){
      if(!byStore.has(game.seller))byStore.set(game.seller,[]);
      byStore.get(game.seller).push(game);
    }
    const candidates=[...byStore].map(([name,items])=>({...optimize(items,cents,mode),seller:name,mixed:false}))
      .filter(b=>b.items.length)
      .sort((a,b)=>b.utility-a.utility||b.points-a.points||a.spent-b.spent||b.saved-a.saved||a.seller.localeCompare(b.seller));
    return {...(candidates[0]||{items:[],spent:0,points:0,utility:0,saved:0,seller:'',mixed:false}),alternatives:candidates.slice(1,6)};
  }
  function eligible(){
    if(!state.collectionLoaded)return [];
    const maps=collectionMap();
    return state.listings.map(g=>getRecord(g,maps)).filter(g=>
      !!g.cg&&!!g.id&&!!g.wanted&&!!g.interestScore&&
      !g.cg.status.own&&Number.isFinite(g.sale)&&g.sale>0
    );
  }
  function config(){
    const amount=Number($('budgetAmount').value);
    const valid=$('budgetAmount').value.trim()!==''&&Number.isFinite(amount)&&amount>=0.01&&amount<=500;
    return {amount,valid,limit:valid?Math.round(amount*100):0,
      mode:$('budgetStrategy').value,scope:$('budgetScope').value,seller:$('budgetSeller').value};
  }
  function statistic(label,value){
    return '<div class="basket-stat"><span>'+safe(label)+'</span><b>'+safe(value)+'</b></div>';
  }
  function view(){
    current=null;
    const settings=config();
    if(!settings.valid)return '<div class="budget-empty">Enter a budget from $0.01 to $500.00.</div>';
    if(!state.collectionLoaded)return '<div class="budget-empty"><b>Load a BGG collection first</b><p>We can then identify games marked Want, Want to Buy, or Wishlist.</p></div>';
    if(!state.listings.length)return '<div class="budget-empty"><b>Import Shop.com results first</b><p>Use the console script and import controls at the top of the page.</p></div>';
    const games=eligible();
    if(!games.length)return '<div class="budget-empty"><b>No verified wanted games yet</b><p>Use Find BGG matches. Owned and uncertain titles are deliberately excluded.</p></div>';
    const plan=bestBasket(games,settings.limit,settings.mode,settings.scope,settings.seller);
    if(!plan.items.length)return '<div class="budget-empty"><b>Nothing fits '+money(settings.amount)+' at the selected store(s)</b><p>'+games.length+' wanted listings are matched, but none qualify within the budget.</p></div>';
    current=plan;
    const perDollar=plan.spent?plan.points/(plan.spent/100):0;
    const stats='<div class="basket-stats">'+
      statistic('Games',plan.items.length)+
      statistic('Basket total',money(plan.spent/100))+
      statistic('Budget remaining',money((settings.limit-plan.spent)/100))+
      statistic('Interest points',plan.points)+
      statistic('Points per $',perDollar.toFixed(2))+'</div>';
    const cards=plan.items.map(game=>
      '<div class="basket-game">'+imageHtml(game)+
      '<div class="name"><div class="strong">'+productLink(game)+'</div>'+
      '<div class="basket-meta">'+safe(game.seller)+' · '+safe(game.tags.join(' / '))+
      (game.rating!=null?' · BGG '+game.rating.toFixed(2):'')+'</div></div>'+
      interestHtml(game)+
      '<span class="small">'+(game.off?Math.round(game.off)+'% off':'Regular')+'</span>'+
      '<span class="price">'+money(game.sale)+'</span></div>'
    ).join('');
    const alternatives=plan.alternatives.length?
      '<div class="subtle"><div class="hint"><b>Other single-store baskets</b> · compare the alternatives</div>'+
      '<div class="basket-alt">'+plan.alternatives.map(x=>
        '<button data-budget-seller="'+safe(x.seller)+'">'+safe(x.seller)+' · '+x.points+' points · '+money(x.spent/100)+'</button>'
      ).join('')+'</div></div>':'';
    const objective=settings.mode==='interest'?'Maximum total interest points':
      settings.mode==='markdown'?'Prioritize wanted games with deeper markdowns':
      'Balance wishlist interest and sale discount';
    return '<section class="panel"><div class="basket-head"><h2>Optimized basket · '+safe(plan.seller)+'</h2>'+
      '<div class="row"><button data-basket-copy>Copy list</button><button class="primary" data-basket-export>Export basket CSV</button></div></div>'+
      stats+'<div class="hint">'+safe(objective)+' · '+games.length+' qualifying listings · Listed-price savings '+money(plan.saved/100)+'</div>'+
      '<div class="basket-list">'+cards+'</div>'+
      '<p class="basket-note">One copy per BGG game. These prices are imported snapshots and exclude shipping, tax, order coupons and inventory checks.'+
      (plan.mixed?' Multiple sellers may increase delivery costs.':' Store shipping minimums may change the effective deal.')+'</p>'+
      alternatives+'</section>';
  }
  function refreshSellers(){
    const field=$('budgetSeller'),chosen=field.dataset.preferred??field.value;
    const sellers=[...new Set(state.listings.map(g=>g.seller))].sort((a,b)=>a.localeCompare(b));
    field.innerHTML='<option value="">Auto / all sellers</option>'+
      sellers.map(x=>'<option value="'+safe(x)+'">'+safe(x)+'</option>').join('');
    field.value=sellers.includes(chosen)?chosen:'';
    delete field.dataset.preferred;
    const c=config();
    $('budgetGo').textContent=c.valid?'Find '+money(c.amount)+' basket':'Set budget';
  }
  function save(){
    try{localStorage.setItem('shoplab-budget-settings',JSON.stringify({
      amount:$('budgetAmount').value,mode:$('budgetStrategy').value,
      scope:$('budgetScope').value,seller:$('budgetSeller').value
    }));}catch{}
  }
  function exportCSV(){
    if(!current?.items?.length)return;
    const head=['Seller','Game','Full Price','Sale Price','Discount %','Interest Points','BGG Rating','BGG ID','Shop URL'];
    const rows=[head,...current.items.map(g=>[g.seller,g.game,g.full.toFixed(2),g.sale.toFixed(2),g.off.toFixed(1),g.interestScore,g.rating??'',g.id,g.url])];
    const csv=rows.map(row=>row.map(escapeCSV).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
    a.href=url;a.download='shop-budget-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  async function copyList(){
    if(!current?.items?.length)return;
    const lines=['Shop budget basket · '+current.seller,'Total: '+money(current.spent/100)+' · '+current.points+' interest points',
      ...current.items.map(g=>g.game+' | '+g.seller+' | '+money(g.sale)+' | '+g.interestScore+' points'+(g.url?' | '+g.url:''))];
    const output=lines.join('\n');
    try{await navigator.clipboard.writeText(output);status('importStatus','Optimized shopping list copied.');}
    catch{window.prompt('Copy shopping list:',output);}
  }
  function init(){
    try{
      const settings=JSON.parse(localStorage.getItem('shoplab-budget-settings')||'{}');
      if(settings.amount!==undefined)$('budgetAmount').value=settings.amount;
      if(['interest','balanced','markdown'].includes(settings.mode))$('budgetStrategy').value=settings.mode;
      if(['single','mixed'].includes(settings.scope))$('budgetScope').value=settings.scope;
      if(typeof settings.seller==='string')$('budgetSeller').dataset.preferred=settings.seller;
    }catch{}
    for(const id of ['budgetAmount','budgetStrategy','budgetScope','budgetSeller']){
      $(id).addEventListener(id==='budgetAmount'?'input':'change',()=>{save();if(state.tab==='budget')render();});
    }
    $('budgetGo').onclick=()=>{
      state.tab='budget';state.page=1;save();render();
      $('content').scrollIntoView({behavior:'smooth',block:'start'});
    };
    $('content').addEventListener('click',event=>{
      if(event.target.closest('[data-basket-export]'))exportCSV();
      if(event.target.closest('[data-basket-copy]'))copyList();
      const other=event.target.closest('[data-budget-seller]');
      if(other){$('budgetSeller').value=other.dataset.budgetSeller;save();state.tab='budget';render();}
    });
  }
  return {init,refreshSellers,view,optimize,bestBasket,utility};
})();