/* Exportação XLSX local, sem CDN: não expõe dados a serviços externos.
 * Gera Office Open XML (ZIP) com 6 abas, filtros e cabeçalhos. */
(function(){
  const xml=value=>String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
  const alphabet=n=>{let letters="";for(let i=n+1;i>0;i=Math.floor((i-1)/26))letters=String.fromCharCode(65+(i-1)%26)+letters;return letters;};
  function worksheet(headers,rows){
    const width=headers.map((x,i)=>Math.max(12,Math.min(44,Math.max(String(x).length,
      ...rows.slice(0,250).map(row=>String(row[i]??"").length))+3)));
    const cols='<cols>'+width.map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>').join("")+'</cols>';
    const all=[headers,...rows];
    const rowXml=all.map((row,ri)=>'<row r="'+(ri+1)+'">'+row.map((v,ci)=>{
      const ref=alphabet(ci)+(ri+1);
      if(ri>0&&typeof v==="number"&&Number.isFinite(v))return '<c r="'+ref+'" s="2"><v>'+v+'</v></c>';
      return '<c r="'+ref+'" s="'+(ri===0?1:0)+'" t="inlineStr"><is><t xml:space="preserve">'+xml(v)+'</t></is></c>';
    }).join("")+'</row>').join("");
    const range='A1:'+alphabet(headers.length-1)+Math.max(1,all.length);
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'+
      '<sheetFormatPr defaultRowHeight="17"/>'+cols+
      '<sheetData>'+rowXml+'</sheetData><autoFilter ref="'+range+'"/></worksheet>';
  }
  const table=(headers,rows)=>({headers,rows});
  function buildSheets(data){
    const categories=data.categorias||[],items=(data.componentes||[]).filter(x=>!x.arquivado&&!/^FILAMENTO-\d+$/.test(x.import_key||""));
    const groups=data.grupos_variacoes||[],filaments=data.filamentos||[],reservations=data.reservas||[];
    const catMap=new Map(categories.map(x=>[Number(x.id),x.nome]));
    const familyName=v=>String(v||"").trim();
    const available=x=>Math.max(0,Number(x.quantidade||0)-Number(x.em_uso||0)-Number(x.com_defeito||0));
    const audience=x=>Number(x.permitir_petianos)===1&&Number(x.permitir_visitantes)===1?"Todos":
      Number(x.permitir_petianos)===1?"PETianes":Number(x.permitir_visitantes)===1?"Visitantes":"Ninguém";
    const members=new Map();
    items.forEach(x=>{const k=familyName(x.grupo_variacoes).toLocaleLowerCase("pt-BR");if(k){if(!members.has(k))members.set(k,[]);members.get(k).push(x);}});
    const names=[...new Set([...groups.map(g=>familyName(typeof g==="string"?g:g.nome)),
      ...items.map(x=>familyName(x.grupo_variacoes))].filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b,"pt-BR",{sensitivity:"base"}));
    const quantities=x=>[Number(x.quantidade||0),available(x),Number(x.em_uso||0),Number(x.com_defeito||0)];
    const stockTotal=items.reduce((v,x)=>v+Number(x.quantidade||0),0);
    return [
      ["Resumo",table(["Indicador","Valor"],[
        ["Exportado em",new Date().toLocaleString("pt-BR")],
        ["Componentes cadastrados",items.length],
        ["Grupos de vínculos",names.length],
        ["Categorias ativas",categories.filter(c=>!c.arquivada).length],
        ["Quantidade total",stockTotal],
        ["Disponíveis",items.reduce((v,x)=>v+available(x),0)],
        ["Em uso",items.reduce((v,x)=>v+Number(x.em_uso||0),0)],
        ["Com defeito",items.reduce((v,x)=>v+Number(x.com_defeito||0),0)],
        ["Cores de filamento",filaments.length],
        ["Registros de movimentação",reservations.length],
      ])],
      ["Materiais",table(["ID","Material","Categoria","Vínculo","Quantidade","Disponível","Em uso","Defeito","Unidade","Identificação","Patrimônio","Visibilidade","Permissão de empréstimo","Observações","Defeitos descritos","Última alteração"],items.sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR")).map(x=>
        [x.id,x.nome,catMap.get(Number(x.categoria_id))||"Sem categoria",familyName(x.grupo_variacoes)||"Não",...quantities(x),x.unidade||"unidades",x.identificacao||"",x.patrimonio||"",
        Number(x.visivel_visitante)===1?"Todos":"Só PETianes",audience(x),x.observacoes||"",x.descricao_defeito||"",x.ultima_alteracao||""]))],
      ["Vínculos",table(["Grupo","Componente","ID","Quantidade","Disponível","Em uso","Defeito"],names.flatMap(name=>{
        const groupItems=members.get(name.toLocaleLowerCase("pt-BR"))||[];
        return groupItems.length?groupItems.map(x=>[name,x.nome,x.id,...quantities(x)]):[[name,"(Grupo vazio)","",0,0,0,0]];
      }))],
      ["Categorias",table(["ID","Categoria","Ativa","Visível para visitantes","PETianes retiram","Visitantes reservam","Materiais vinculados"],categories.map(c=>
        [c.id,c.nome,c.arquivada?"Não":"Sim",Number(c.visivel_visitante)===1?"Sim":"Não",Number(c.permitir_petianos)===1?"Sim":"Não",Number(c.permitir_visitantes)===1?"Sim":"Não",items.filter(x=>Number(x.categoria_id)===Number(c.id)).length]))],
      ["Estoque",table(["Tipo","Material ou cor","Grupo","Quantidade","Disponível","Em uso","Defeito","Unidade"],[
        ...items.map(x=>["Material",x.nome,familyName(x.grupo_variacoes),...quantities(x),x.unidade||"unidades"]),
        ...filaments.map(x=>["Filamento",x.cor,"",...quantities(x),"rolos"])
      ])],
      ["Movimentações",table(["ID","Material","Solicitante","Quantidade","Tipo","Situação","Início","Devolução prevista","Devolução efetiva","Solicitação","Contato","Observação"],reservations.map(x=>
        [x.id,x.componente_nome||items.find(v=>v.id===x.componente_id)?.nome||"",x.nome_solicitante||"",Number(x.quantidade||0),
        x.tipo||"",x.status||"",x.data_inicio||"",x.data_devolucao||"",x.devolvido_em||"",x.solicitado_em||"",x.contato||"",x.observacao||""]))],
    ];
  }
  // CRC-32 obrigatório para arquivos ZIP.
  const crcTable=Array.from({length:256},(_,n)=>{let x=n;for(let i=0;i<8;i++)x=x&1?0xedb88320^(x>>>1):x>>>1;return x>>>0;});
  function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
  function u16(n){return [n&255,(n>>>8)&255];}
  function u32(n){return [n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];}
  function zip(entries){
    const encoder=new TextEncoder(),chunks=[],central=[];
    let offset=0;
    const add=part=>{chunks.push(part);offset+=part.length;};
    for(const [name,data] of entries){
      const filename=encoder.encode(name),body=encoder.encode(data),size=body.length,checksum=crc32(body);
      const header=Uint8Array.from([...u32(0x04034b50),...u16(20),...u16(0x800),...u16(0),...u16(0),...u16(0),
        ...u32(checksum),...u32(size),...u32(size),...u16(filename.length),...u16(0)]);
      const thisOffset=offset;add(header);add(filename);add(body);
      central.push(Uint8Array.from([...u32(0x02014b50),...u16(20),...u16(20),...u16(0x800),...u16(0),
        ...u16(0),...u16(0),...u32(checksum),...u32(size),...u32(size),
        ...u16(filename.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(thisOffset),...filename]));
    }
    const centralOffset=offset;
    for(const part of central)add(part);
    const centralSize=offset-centralOffset;
    add(Uint8Array.from([...u32(0x06054b50),...u16(0),...u16(0),
      ...u16(central.length),...u16(central.length),...u32(centralSize),...u32(centralOffset),...u16(0)]));
    return new Blob(chunks,{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  }
  function exportXlsx(data){
    const sheets=buildSheets(data);
    const types='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
      '<Default Extension="xml" ContentType="application/xml"/>'+
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+
      sheets.map((_,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join("")+'</Types>';
    const workbook='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
      '<sheets>'+sheets.map(([name],i)=>'<sheet name="'+xml(name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join("")+'</sheets></workbook>';
    const rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
      sheets.map((_,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join("")+
      '<Relationship Id="rId'+(sheets.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
    const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts>'+
      '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'+
      '<fill><patternFill patternType="solid"><fgColor rgb="FF087B6C"/><bgColor indexed="64"/></patternFill></fill></fills>'+
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'+
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
      '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'+
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'+
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>';
    const entries=[["[Content_Types].xml",types],["_rels/.rels",
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ["xl/workbook.xml",workbook],["xl/_rels/workbook.xml.rels",rels],["xl/styles.xml",styles],
      ...sheets.map(([_,data],i)=>["xl/worksheets/sheet"+(i+1)+".xml",worksheet(data.headers,data.rows)])];
    const blob=zip(entries),url=URL.createObjectURL(blob),anchor=document.createElement("a");
    const date=new Date().toLocaleDateString("en-CA");
    anchor.href=url;anchor.download="inventario-pet-"+date+".xlsx";
    document.body.appendChild(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    return {sheets:sheets.length,bytes:blob.size};
  }
  window.exportPETInventoryXLSX=exportXlsx;
})();
