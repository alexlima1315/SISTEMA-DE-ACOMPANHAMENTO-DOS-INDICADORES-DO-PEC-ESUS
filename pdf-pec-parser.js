const PDFJS_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
const PDFJS_WORKER_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
let pdfjsPromise;

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    .replace(/[-–—_/()[\].,;:]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function csvCell(value) {
  return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
}
function dateIn(value) {
  const match = String(value || '').match(/\b\d{1,2}[\/-]\d{1,2}[\/-]\d{4}\b/);
  return match ? match[0] : '';
}
function transformPoint(viewport, itemTransform) {
  const a = viewport.transform, b = itemTransform;
  return [a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}
function lineGroups(items) {
  const lines = [];
  items.forEach(item => {
    const text = String(item.str || '').trim();
    if (!text) return;
    const [x, y] = item.position;
    let line = lines.find(candidate => Math.abs(candidate.y - y) < 3.5);
    if (!line) { line = { y, items: [] }; lines.push(line); }
    line.items.push({ x, text });
  });
  lines.forEach(line => {
    line.items.sort((a, b) => a.x - b.x);
    line.text = line.items.map(item => item.text).join(' ').replace(/\s+/g, ' ').trim();
  });
  return lines.sort((a, b) => a.y - b.y);
}

/**
 * Lê o relatório vetorial "Acompanhamento de cidadãos vinculados" do PEC
 * inteiramente no navegador. Dados pessoais não são enviados ao CDN nem ao site.
 */
export async function parsePecPdf(file, onProgress) {
  if (!pdfjsPromise) {
    pdfjsPromise = import(PDFJS_URL).then(pdfjs => {
      pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return pdfjs;
    });
  }
  const pdfjs = await pdfjsPromise;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  if (pdf.numPages > 500) throw new Error('O PDF tem mais de 500 páginas. Divida o relatório e tente novamente.');
  const records = [];
  let team = '', ine = '', extractableCharacters = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    if (onProgress) onProgress(pageNumber, pdf.numPages);
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const positioned = [];
    content.items.forEach(item => {
      const text = String(item.str || '').trim();
      if (!text) return;
      extractableCharacters += text.length;
      positioned.push({ str: text, position: transformPoint(viewport, item.transform) });
    });
    const lines = lineGroups(positioned);
    if (!team) {
      const teamLine = lines.find(line => /EQUIPE\s*:/i.test(line.text));
      if (teamLine) {
        const match = teamLine.text.match(/EQUIPE\s*:\s*(.+?)(?:\s*[|/]\s*(\d{7,10}))?$/i);
        if (match) {
          team = String(match[1] || '').trim();
          if (match[2]) ine = match[2].replace(/^0+/, '');
        }
        const ineMatch = teamLine.text.match(/\b\d{7,10}\b/);
        if (!ine && ineMatch) ine = ineMatch[0].replace(/^0+/, '');
      }
    }

    const headerIndex = lines.findIndex(line => {
      const header = normalizeText(line.text);
      return header.includes('CIDADAO') && header.includes('SEXO') && header.includes('ATUALIZACAO');
    });
    // PEC normalmente imprime o cabeçalho da tabela só na primeira página.
    // Nas páginas seguintes, reutilizamos as mesmas faixas de coluna e o início
    // da área de dados após o bloco de filtros institucional.
    const headerY = headerIndex >= 0 ? lines[headerIndex].y : 78;
    const starts = [];
    let lastStart = -999;
    lines.slice(headerIndex >= 0 ? headerIndex + 1 : 0).forEach(line => {
      if (line.y <= headerY + 4 || line.y > viewport.height - 42) return;
      const left = line.items.filter(item => item.x >= 5 && item.x < 190).map(item => item.text).join(' ').trim();
      if (!left || /^(CPF|CNS)\s*[:\-]/i.test(left) || normalizeText(left) === 'CIDADAO') return;
      if (line.y - lastStart > 19) { starts.push({ y: line.y, name: left }); lastStart = line.y; }
    });

    starts.forEach((start, index) => {
      const endY = index + 1 < starts.length ? starts[index + 1].y : viewport.height - 38;
      const band = lines.filter(line => line.y >= start.y - 1 && line.y < endY - 1);
      const cells = { left: [], sex: [], age: [], dob: [], address: [], phone: [], updated: [] };
      band.forEach(line => line.items.forEach(item => {
        if (item.x < 190) cells.left.push(item.text);
        else if (item.x < 325) cells.sex.push(item.text);
        else if (item.x < 395) cells.age.push(item.text);
        else if (item.x < 460) cells.dob.push(item.text);
        else if (item.x < 680) cells.address.push(item.text);
        else if (item.x < 760) cells.phone.push(item.text);
        else cells.updated.push(item.text);
      }));
      const leftText = cells.left.join(' ').replace(/\s+/g, ' ').trim();
      const rowText = band.flatMap(line => line.items).sort((a, b) => a.x - b.x).map(item => item.text).join(' ').replace(/\s+/g, ' ').trim();
      const name = String(start.name || '').replace(/\s+(CPF|CNS)\s*[:\-].*$/i, '').trim();
      const cpf = leftText.match(/\bCPF\s*[:\-]?\s*([\d.\- ]{11,})/i);
      const cns = leftText.match(/\bCNS\s*[:\-]?\s*([\d.\- ]{11,})/i);
      const dob = dateIn(cells.dob.join(' '));
      const updated = dateIn(cells.updated.join(' '));
      const phoneMatch = rowText.match(/(?:\(\d{2}\)|\b\d{2})\s*9?\d{4}[-.\s]?\d{4}\b/);
      const phone = cells.phone.join(' ').trim() || (phoneMatch ? phoneMatch[0].trim() : '');
      if (!name || !dob) return;
      records.push([name, cpf ? cpf[1].trim() : '', cns ? cns[1].trim() : '', dob,
        cells.sex.join(' ').trim(), cells.age.join(' ').trim(), cells.address.join(' ').trim(),
        phone, updated]);
    });
  }

  if (extractableCharacters < 20) {
    throw new Error('Este PDF parece ser uma imagem escaneada sem texto selecionável. Exporte o relatório diretamente em PDF pelo menu Relatórios do PEC e-SUS APS.');
  }
  if (!records.length) {
    throw new Error('O PDF contém texto, mas não reconheci a tabela “Acompanhamento de cidadãos vinculados”. Confira o modelo do relatório ou envie CSV/Excel.');
  }

  const columns = ['NOME DO CIDADAO', 'CPF', 'CNS', 'DATA DE NASCIMENTO', 'SEXO', 'IDADE',
    'ENDERECO', 'TELEFONE CELULAR', 'ULTIMA ATUALIZACAO'];
  const rows = [['EQUIPE RESPONSAVEL', team], ['INE DA EQUIPE', ine], columns].concat(records);
  const text = rows.map(row => row.map(csvCell).join(',')).join('\n');
  return {
    text, pages: pdf.numPages, records: records.length, team, ine, columns,
    preview: records.slice(0, 5).map(row => ({ name: row[0], updated: row[8] }))
  };
}
