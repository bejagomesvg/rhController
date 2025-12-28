type RotatedLabelOptions = {
  color?: string
  rotateDeg?: number
  offsetY?: number
  fontSize?: number
  textAnchor?: 'start' | 'middle' | 'end'
}

// CHAMADA {createRotatedLabelRenderer(formatCurrency, { color: '#F87171' })}
// RETORNA UM RENDERER DE LABEL ROTACIONADO PARA GRÁFICOS
// valueFormatter: função para formatar o valor exibido na label
// options: opções para personalizar a aparência e posição da label
// - color: cor do texto da label (padrão: '#00c950')
// - rotateDeg: ângulo de rotação da label em graus (padrão: -90)
// - offsetY: deslocamento vertical da label (padrão: -5)
// - fontSize: tamanho da fonte da label (padrão: 11)
// - textAnchor: alinhamento do texto ('start', 'middle', 'end') (padrão: 'start')
export const createRotatedLabelRenderer = (
  valueFormatter: (val: number) => string,
  {
    color = '#00c950',
    rotateDeg = -90,
    offsetY = -5,
    fontSize = 11,
    textAnchor = 'start',
  }: RotatedLabelOptions = {},
) => {
  return (props: any) => {
    const { x = 0, y = 0, width = 0, value } = props
    const cx = x + width / 2
    const cy = y + offsetY
    const formatted = valueFormatter(Number(value ?? 0))
    if (!formatted) return null

    return (
      <text
        x={cx}
        y={cy + 5}
        fill={color}
        fontSize={fontSize}
        textAnchor={textAnchor}
        transform={`rotate(${rotateDeg} ${cx} ${cy})`}
      >
        {formatted}
      </text>
    )
  }
}
