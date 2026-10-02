const json=(res,status,body)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Access-Control-Allow-Origin','*');return res.status(status).json(body)};
const clean=s=>String(s??'').trim();
async function sb(path,opts={}){
 const url=process.env.SUPABASE_URL||'https://jadyqyrpgcmaixroizov.supabase.co';
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
 if(!key) throw new Error('Supabase service credential is not configured');
 const r=await fetch(url+'/rest/v1/'+path,{...opts,headers:{Authorization:'Bearer '+key,apikey:key,'Content-Type':'application/json',Accept:'application/json',...(opts.headers||{})}});
 const text=await r.text(); if(!r.ok) throw new Error(text||('Supabase HTTP '+r.status)); return text?JSON.parse(text):[];
}
module.exports=async(req,res)=>{
 if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,DELETE,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');return res.status(204).end()}
 try{
  const owner=clean(req.query.owner||req.body?.owner||'sportomax').slice(0,80);
  if(req.method==='GET'){
   const [fields,values]=await Promise.all([
    sb('bgg_custom_fields?select=*&owner=eq.'+encodeURIComponent(owner)+'&order=sort_order.asc,id.asc'),
    sb('bgg_custom_values?select=*&owner=eq.'+encodeURIComponent(owner)+'&limit=20000')
   ]);
   return json(res,200,{ok:true,fields,values});
  }
  if(req.method==='POST'){
   const b=req.body||{};
   if(b.action==='field'){
    const label=clean(b.label).slice(0,100), field_type=clean(b.field_type||'boolean');
    if(!label||!['boolean','text','number','select','multiselect'].includes(field_type)) return json(res,400,{ok:false,error:'Invalid field'});
    const field_key=clean(b.field_key||label.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')).slice(0,80);
    if(!field_key) return json(res,400,{ok:false,error:'Field key is required'});
    const rows=await sb('bgg_custom_fields?on_conflict=owner,field_key',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({owner,field_key,label,field_type,options:Array.isArray(b.options)?b.options:[],sort_order:Number(b.sort_order)||0,updated_at:new Date().toISOString()})});
    return json(res,200,{ok:true,row:rows[0]});
   }
   if(b.action==='value'){
    const bgg_id=Number(b.bgg_id), field_key=clean(b.field_key).slice(0,80);
    if(!Number.isInteger(bgg_id)||!field_key) return json(res,400,{ok:false,error:'bgg_id and field_key required'});
    const rows=await sb('bgg_custom_values?on_conflict=owner,bgg_id,field_key',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({owner,bgg_id,field_key,value:b.value,updated_at:new Date().toISOString()})});
    return json(res,200,{ok:true,row:rows[0]});
   }
   return json(res,400,{ok:false,error:'Unknown action'});
  }
  if(req.method==='DELETE'){
   const kind=clean(req.query.kind), field_key=clean(req.query.field_key), bgg_id=Number(req.query.bgg_id);
   if(!field_key) return json(res,400,{ok:false,error:'field_key required'});
   if(kind==='field'){
    await sb('bgg_custom_values?owner=eq.'+encodeURIComponent(owner)+'&field_key=eq.'+encodeURIComponent(field_key),{method:'DELETE',headers:{Prefer:'return=minimal'}});
    await sb('bgg_custom_fields?owner=eq.'+encodeURIComponent(owner)+'&field_key=eq.'+encodeURIComponent(field_key),{method:'DELETE',headers:{Prefer:'return=minimal'}});
   } else if(Number.isInteger(bgg_id)){
    await sb('bgg_custom_values?owner=eq.'+encodeURIComponent(owner)+'&bgg_id=eq.'+bgg_id+'&field_key=eq.'+encodeURIComponent(field_key),{method:'DELETE',headers:{Prefer:'return=minimal'}});
   } else return json(res,400,{ok:false,error:'bgg_id required'});
   return json(res,200,{ok:true});
  }
  return json(res,405,{ok:false,error:'Unsupported method'});
 }catch(e){return json(res,500,{ok:false,error:e.message})}
};