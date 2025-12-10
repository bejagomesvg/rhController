import * as XLSX from 'xlsx'

export interface OvertimeTransformRow {
  Data: string
  Cadastro: string
  Nome: string
  '303': string
  '304': string
  '505': string
  '506': string
  '511': string
  '512': string
}

export interface OvertimeTransformResult {
  rows: OvertimeTransformRow[]
  period: string
}

const CODIGOS_INTERESSE = new Set(['303', '304', '505', '506', '511', '512'])

const tempoStrParaMinutos = (valor: any): number => {
  if (valor === null || valor === undefined) return 0

  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) return 0
    return Math.round(valor * 24 * 60) // Excel fraction of day -> minutes
  }

  const s = String(valor).trim()
  if (!s || s.toUpperCase() === 'NAT') return 0

  const m = s.match(/(\d+):(\d{2})(?::(\d{2})(?:\.\d+)?)?/)
  if (!m) return 0

  const horas = Number(m[1])
  const minutos = Number(m[2])
  if (Number.isNaN(horas) || Number.isNaN(minutos)) return 0
  return horas * 60 + minutos
}

const minutosParaHHMM = (minutos: number): string => {
  if (minutos <= 0) return ''
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const normalize = (value: any) => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '')

const hasStructuredHeaders = (headerRow: any[]): boolean => {
  const normalized = headerRow.map((h) => normalize(h).trim().toLowerCase())
  return ['data', 'cadastro', 'nome', '303', '304', '505', '506', '511', '512'].every((h) => normalized.includes(h))
}

const toHHMM = (v: any) => {
  const min = tempoStrParaMinutos(v)
  return min > 0 ? minutosParaHHMM(min) : ''
}

const getDateFromJ5 = (matriz: any[][]): string => {
  const val = matriz?.[4]?.[9] // linha 5, coluna J (base 0)
  return val === null || val === undefined ? '' : String(val).trim()
}

const extrairPeriodo = (matriz: any[][]): string => {
  for (let rowIdx = 0; rowIdx < matriz.length; rowIdx += 1) {
    const row = matriz[rowIdx]
    for (let col = 0; col < row.length; col += 1) {
      const cellValue = row[col]
      if (cellValue !== null && cellValue !== undefined) {
        const cellStr = String(cellValue).trim()
        if (normalize(cellStr).toLowerCase() === 'periodo:') {
          for (let nextCol = col + 1; nextCol < Math.min(col + 4, row.length); nextCol += 1) {
            const dataCell = row[nextCol]
            if (dataCell !== null && dataCell !== undefined) {
              const dataStr = String(dataCell).trim()
              const match = dataStr.match(/(\d{2}\/\d{2}\/\d{4})/)
              if (match) {
                return match[1]
              }
            }
          }
        }
      }
    }
  }
  return ''
}

export const transformOvertimeApuracao = (buffer: ArrayBuffer): OvertimeTransformResult => {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  const matriz = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: true, defval: null, blankrows: false }) as any[][]
  const dateFromJ5 = getDateFromJ5(matriz)

  // Caso o arquivo já esteja no layout final (Data, Cadastro, Nome, 303...512), apenas normaliza para HH:MM
  if (matriz.length > 0 && hasStructuredHeaders(matriz[0])) {
    const json = XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: true }) as any[]
    const rows: OvertimeTransformRow[] = json.map((row) => ({
      Data: dateFromJ5 || String(row['Data'] ?? row['data'] ?? ''),
      Cadastro: String(row['Cadastro'] ?? row['cadastro'] ?? ''),
      Nome: String(row['Nome'] ?? row['nome'] ?? ''),
      '303': toHHMM(row['303']),
      '304': toHHMM(row['304']),
      '505': toHHMM(row['505']),
      '506': toHHMM(row['506']),
      '511': toHHMM(row['511']),
      '512': toHHMM(row['512']),
    }))
    return { rows, period: dateFromJ5 || '' }
  }

  const colaboradores = new Map<
    string,
    {
      cadastro: string
      nome: string
      minutos: Record<'303' | '304' | '505' | '506' | '511' | '512', number>
    }
  >()

  let matriculaAtual: string | null = null
  let nomeAtual: string | null = null

  const periodo = dateFromJ5 || extrairPeriodo(matriz)

  const detectarMatriculaNome = (row: any[]) => {
    for (let i = 0; i < row.length; i += 1) {
      const mat = row[i]
      const nome = row[i + 1]
      const matStr = mat !== null && mat !== undefined ? String(mat).split('.')[0] : ''
      const matNum = Number(matStr)
      if (!Number.isNaN(matNum) && matNum >= 100000 && typeof nome === 'string' && nome.trim()) {
        return { cadastro: String(matNum).padStart(6, '0'), nome: nome.trim() }
      }
    }
    return null
  }

  const encontrarCodigoEHora = (row: any[]) => {
    let codigoIdx = -1
    let codigoValor: string | null = null
    for (let i = 0; i < row.length; i += 1) {
      const v = row[i]
      if (v === null || v === undefined) continue
      const vStr = String(v).trim()
      if (CODIGOS_INTERESSE.has(vStr)) {
        codigoIdx = i
        codigoValor = vStr
        break
      }
    }
    if (codigoIdx === -1 || !codigoValor) return null

    // Procura hora após o código, senão em qualquer coluna
    const isHora = (val: any) => {
      if (val === null || val === undefined || val === '') return false
      if (typeof val === 'number') return Number.isFinite(val)
      return /\d+:\d{2}/.test(String(val))
    }

    let horaValor: any = null
    for (let c = codigoIdx + 1; c < row.length; c += 1) {
      if (isHora(row[c])) {
        horaValor = row[c]
        break
      }
    }
    if (horaValor === null) {
      for (let c = 0; c < row.length; c += 1) {
        if (isHora(row[c])) {
          horaValor = row[c]
          break
        }
      }
    }
    if (horaValor === null) return null
    return { codigo: codigoValor, horaValor }
  }

  matriz.forEach((row) => {
    const detectado = detectarMatriculaNome(row)
    if (detectado) {
      matriculaAtual = detectado.cadastro
      nomeAtual = detectado.nome

      if (!colaboradores.has(matriculaAtual)) {
        colaboradores.set(matriculaAtual, {
          cadastro: matriculaAtual,
          nome: nomeAtual,
          minutos: { '303': 0, '304': 0, '505': 0, '506': 0, '511': 0, '512': 0 },
        })
      } else {
        const colab = colaboradores.get(matriculaAtual)!
        colab.nome = nomeAtual
      }
    }

    if (matriculaAtual) {
      const codigoHora = encontrarCodigoEHora(row)
      if (codigoHora) {
        const minutos = tempoStrParaMinutos(codigoHora.horaValor)
        const colab = colaboradores.get(matriculaAtual)
        if (colab) {
          colab.minutos[codigoHora.codigo as keyof typeof colab.minutos] += minutos
        }
      }
    }
  })

  const rows: OvertimeTransformRow[] = Array.from(colaboradores.values())
    .sort((a, b) => a.cadastro.localeCompare(b.cadastro))
    .map((colab) => ({
      Data: periodo,
      Cadastro: colab.cadastro,
      Nome: colab.nome,
      '303': minutosParaHHMM(colab.minutos['303']),
      '304': minutosParaHHMM(colab.minutos['304']),
      '505': minutosParaHHMM(colab.minutos['505']),
      '506': minutosParaHHMM(colab.minutos['506']),
      '511': minutosParaHHMM(colab.minutos['511']),
      '512': minutosParaHHMM(colab.minutos['512']),
    }))

  return { rows, period: periodo }
}
