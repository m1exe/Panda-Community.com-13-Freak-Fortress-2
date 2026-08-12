// Browser-side VDF / KeyValues parser based on the structure of the original
// C# parser. It intentionally accepts comments, quoted strings and nested blocks.

function tokenize(text){
  const out=[]; let i=0,line=1;
  while(i<text.length){
    const c=text[i];
    if(c==="\n"){line++;i++;continue}
    if(/\s/.test(c)){i++;continue}
    if(c==="/"&&text[i+1]==="/"){
      const start=++i; i++;
      while(i<text.length&&text[i]!=="\n")i++;
      out.push({type:"comment",text:text.slice(start,i).trim(),line}); continue;
    }
    if(c==="/"&&text[i+1]==="*"){
      i+=2; while(i+1<text.length&&!(text[i]==="*"&&text[i+1]==="/")){if(text[i]==="\n")line++;i++}
      i+=2; continue;
    }
    if(c==="{"||c==="}"){out.push({type:c,text:c,line});i++;continue}
    if(c==='"'){
      i++; let s="";
      while(i<text.length&&text[i]!=='"'){
        if(text[i]==="\\"&&i+1<text.length){s+=text[i+1];i+=2;continue}
        if(text[i]==="\n")line++;
        s+=text[i++];
      }
      if(text[i]==='"')i++;
      out.push({type:"string",text:s,line}); continue;
    }
    i++; // ignore unexpected characters
  }
  return out;
}
function parseBlock(tokens,pos={i:0}){
  const result=[];
  while(pos.i<tokens.length&&tokens[pos.i].type!=="}"){
    if(tokens[pos.i].type!=="string"){pos.i++;continue}
    const key=tokens[pos.i++]; const node={key:key.text};
    if(tokens[pos.i]?.type==="comment"&&tokens[pos.i].line===key.line){node.comment=tokens[pos.i++].text}
    while(tokens[pos.i]?.type==="comment")pos.i++;
    if(tokens[pos.i]?.type==="{"){
      pos.i++; node.children=parseBlock(tokens,pos);
      if(tokens[pos.i]?.type==="}")pos.i++;
    }else if(tokens[pos.i]?.type==="string"){node.value=tokens[pos.i++].text}
    result.push(node);
  }
  return result;
}
export function parseKeyValues(text){return parseBlock(tokenize(text));}

const classes=new Set(["scout","soldier","pyro","demoman","demo","heavy","heavyweapons","engineer","medic","sniper","spy"]);
function child(children,key){return children?.find(x=>x.key.toLowerCase()===key.toLowerCase())}
function attrs(children){
  const direct=child(children,"custom");
  if(direct?.children)return {official:[],custom:direct.children.filter(x=>x.value!=null)};
  const a=child(children,"attributes");
  if(!a?.children)return {official:[],custom:[]};
  return {
    official:a.children.filter(x=>x.value!=null&&!/^custom$/i.test(x.key)),
    custom:child(a.children,"custom")?.children?.filter(x=>x.value!=null)||[]
  };
}
export function extractItems(root){
  const result=[];
  for(const sectionName of ["Indexes","Classnames"]){
    const section=child(root,sectionName);
    if(!section?.children)continue;
    for(const item of section.children){
      const blocks=[]; const top=attrs(item.children);
      if(top.official.length||top.custom.length)blocks.push({className:null,...top});
      for(const c of item.children||[]){
        if(!classes.has(c.key.toLowerCase()))continue;
        const a=attrs(c.children);
        if(a.official.length||a.custom.length)blocks.push({className:c.key,...a});
      }
      if(blocks.length)result.push({id:item.key,name:item.comment||null,blocks});
    }
  }
  return result;
}