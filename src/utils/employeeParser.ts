// Mapeamento de campos da planilha para banco de dados
export const EMPLOYEE_FIELD_MAPPING = {
  // Campos obrigatórios (conforme SQL)
  Empresa: 'company',
  Cadastro: 'registration',
  Nome: 'name',
  CPF: 'cpf',
  Nascimento: 'date_birth',
  Admissão: 'date_hiring',
  Situação: 'status',
  'Descrição (Situação)': 'description_status',
  'Data Afastamento': 'date_status',
  'Título Reduzido (Cargo)': 'role',
  'Descrição do Local': 'sector',
  'Descrição (Nacionalidade)': 'nationality',
  'Descrição (Instrução)': 'education',
  Sexo: 'sex',
  'Descrição (Estado Civil)': 'marital',
  'Descrição (Raça/Etnia)': 'ethnicity',
  'Valor Salário': 'salary',
}

// Funções de formatação
export const formatCPF = (cpf: any): string => {
  if (!cpf) return ''
  // Remove tudo que não é dígito
  let cleaned = String(cpf).replace(/\D/g, '')
  // Se tiver menos de 11 dígitos, adiciona zeros à frente
  if (cleaned.length < 11) {
    cleaned = cleaned.padStart(11, '0')
  }
  // Formata para XXX.XXX.XXX-XX
  return cleaned.slice(0, 11).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export const formatDate = (date: any): string => {
  if (!date) return ''

  // Se for número (Excel serial date)
  if (typeof date === 'number') {
    // Converter Excel serial date para data JS
    const excelEpoch = new Date('1899-12-30')
    const resultDate = new Date(excelEpoch.getTime() + date * 24 * 60 * 60 * 1000)
    const formatted = resultDate.toISOString().split('T')[0]
    // Verifica se é data inválida ou zero
    if (formatted === '1899-12-30' || formatted === '0000-00-00') return ''
    return formatted
  }

  // Se for string
  const dateStr = String(date).trim()

  // Verifica se é "00/00/0000" ou "00-00-0000"
  if (dateStr === '00/00/0000' || dateStr === '00-00-0000' || dateStr === '0000-00-00') {
    return ''
  }

  // Tenta formato dd/mm/aaaa ou dd/mm/yyyy
  if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
    const [day, month, year] = dateStr.split('/')
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  // Se já estiver em ISO (YYYY-MM-DD)
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr
  }

  return ''
}

export const formatSalary = (salary: any): string => {
  if (!salary && salary !== 0) return ''

  let numValue: number

  // Se for string com formatação brasileira ###.###.##0,0000
  if (typeof salary === 'string') {
    // Remove pontos de milhar e substitui vírgula por ponto
    numValue = parseFloat(String(salary).replace(/\./g, '').replace(',', '.'))
  } else {
    numValue = parseFloat(String(salary))
  }

  if (isNaN(numValue)) return ''

  // Formata para R$ com 2 casas decimais
  return `R$ ${numValue.toFixed(2).replace('.', ',')}`
}

// Normalização para campos inteiros
export const formatInteger = (value: any): string => {
  if (value === null || value === undefined) return ''
  const cleaned = String(value).replace(/\D/g, '')
  return cleaned
}

// Campos obrigatórios que devem estar presentes na planilha
export const REQUIRED_FIELDS = [
  'Empresa',
  'Cadastro',
  'Nome',
  'CPF',
  'Nascimento',
  'Admissão',
  'Situação',
  'Descrição (Situação)',
  'Data Afastamento',
  'Título Reduzido (Cargo)',
  'Descrição do Local',
  'Descrição (Nacionalidade)',
  'Descrição (Instrução)',
  'Sexo',
  'Descrição (Estado Civil)',
  'Descrição (Raça/Etnia)',
  'Valor Salário',
]

export const validateEmployeeSheet = (columns: string[]): { valid: boolean; missingFields: string[] } => {
  const missingFields = REQUIRED_FIELDS.filter((field) => !columns.includes(field))
  return {
    valid: missingFields.length === 0,
    missingFields,
  }
}

export const validateEmployeeRow = (row: Record<string, any>): { valid: boolean; errors: string[] } => {
  const errors: string[] = []

  // Validar campos obrigatórios não vazios
  if (!row['Empresa'] || String(row['Empresa']).trim() === '') errors.push('Empresa é obrigatória')
  if (!row['Cadastro'] || String(row['Cadastro']).trim() === '') errors.push('Cadastro é obrigatório')
  if (!row['Nome'] || String(row['Nome']).trim() === '') errors.push('Nome é obrigatório')
/*   if (!row['CPF'] || String(row['CPF']).trim() === '') errors.push('Cpf é obrigatório')    */ 
  if (!row['Nascimento'] || String(row['Nascimento']).trim() === '') errors.push('Nascimento é obrigatório')
  if (!row['Admissão'] || String(row['Admissão']).trim() === '') errors.push('Admissão é obrigatória')
  if (!row['Situação'] || String(row['Situação']).trim() === '') errors.push('Situação é obrigatória')
  if (!row['Título Reduzido (Cargo)'] || String(row['Título Reduzido (Cargo)']).trim() === '')
    errors.push('Cargo é obrigatório')
  if (!row['Descrição do Local'] || String(row['Descrição do Local']).trim() === '') errors.push('Setor é obrigatório')
  if (!row['Valor Salário'] && row['Valor Salário'] !== 0) errors.push('Salário é obrigatório')

  // Validar CPF quando informado (não é obrigatório)
  if (row['CPF']) {
    const cpfDigits = String(row['CPF']).replace(/\D/g, '')
    if (cpfDigits.length !== 11) {
      errors.push('CPF inválido: deve ter 11 dígitos')
    }
  }

  // Validar campos numéricos (Empresa, Situação)
  if (row['Empresa']) {
    const empresa = formatInteger(row['Empresa'])
    if (!empresa || isNaN(Number(empresa))) {
      errors.push('Empresa deve ser numérica (inteiro)')
    }
  }
  if (row['Situação']) {
    const situacao = formatInteger(row['Situação'])
    if (!situacao || isNaN(Number(situacao))) {
      errors.push('Situação deve ser numérica (inteiro)')
    }
  }

  // Validar e formatar datas
  const dateFields = ['Nascimento', 'Admissão', 'Data Afastamento']
  dateFields.forEach((field) => {
    if (row[field]) {
      const formattedDate = formatDate(row[field])
      // Data Afastamento é opcional, pode estar vazia (00/00/0000)
      if (field !== 'Data Afastamento' && !formattedDate) {
        errors.push(`${field} em formato inválido. Use dd/mm/aaaa ou YYYY-MM-DD`)
      } else if (field !== 'Data Afastamento' && formattedDate) {
        // Validar se é uma data válida (apenas para datas obrigatórias)
        if (isNaN(new Date(formattedDate).getTime())) {
          errors.push(`${field} é uma data inválida`)
        }
      }
    }
  })

  // Validar Salário (deve ser numérico)
  if (row['Valor Salário']) {
    const formatted = formatSalary(row['Valor Salário'])
    if (!formatted) {
      errors.push('Valor Salário deve ser numérico')
    }
  }

  // Validar Sexo (M, F, Masculino, Feminino, etc.)
  if (row['Sexo']) {
    const sexo = String(row['Sexo']).toUpperCase()
    if (!['M', 'F', 'MASCULINO', 'FEMININO'].includes(sexo)) {
      errors.push('Sexo deve ser M/F ou Masculino/Feminino')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export const formatRowData = (row: Record<string, any>): Record<string, any> => {
  return {
    ...row,
    Empresa: formatInteger(row['Empresa']),
    CPF: formatCPF(row['CPF']),
    Nascimento: formatDate(row['Nascimento']),
    Admissão: formatDate(row['Admissão']),
    'Data Afastamento': formatDate(row['Data Afastamento']),
    Situação: formatInteger(row['Situação']),
    'Valor Salário': formatSalary(row['Valor Salário']),
  }
}
