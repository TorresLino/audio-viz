import { LOW_CUTOFF } from "./audioEngine"

export class Visualizer {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement

  constructor(canvasElement: HTMLCanvasElement) {
    this.canvas = canvasElement
    this.ctx = this.canvas.getContext('2d')!
  }

  public draw(data: Float32Array) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    this.ctx.lineWidth = 2
    this.ctx.strokeStyle = '#990000'
    this.ctx.beginPath()

    const sliceWidth = this.canvas.width / data.length
    let x = 0

    for (let i = 0; i < data.length; i++) {
      const v = data[i]
      const y = (v * (this.canvas.height / 2)) + (this.canvas.height / 2)

      if (i === 0) {
        this.ctx.moveTo(x, y)
      } else {
        this.ctx.lineTo(x, y)
      }

      x += sliceWidth
    }

    this.ctx.stroke()
  }
}

export class SpectrumVisualizer {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement

  private readonly minFreq = 27.5
  private readonly maxFreq = 4186.0

  private majorGridX: {x: number, label: string}[] = []
  private minorGridX: number[] = []

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.calculateGridPositions()
  }

  private drawGrid() {
    this.ctx.save()

    this.ctx.font = '10px monospace'
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'top'

    this.ctx.strokeStyle = 'rgba(153, 0, 0, 0.08)'
    this.minorGridX.forEach(x => {
      this.ctx.beginPath()
      this.ctx.moveTo(x, 0)
      this.ctx.lineTo(x, this.canvas.height)
      this.ctx.stroke()
    })

    this.majorGridX.forEach(item => {
      this.ctx.strokeStyle = 'rgba(153, 0, 0, 0.3)'
      this.ctx.lineWidth = 1.5
      this.ctx.setLineDash([5, 5])
      this.ctx.beginPath()
      this.ctx.moveTo(item.x, 0)
      this.ctx.lineTo(item.x, this.canvas.height - 15)
      this.ctx.stroke()

      this.ctx.setLineDash([])
      this.ctx.fillStyle = 'rgba(153, 0, 0, 0.8)'
      this.ctx.fillText(item.label, item.x, this.canvas.height - 12)
    })

    this.ctx.restore()
  }

  private calculateGridPositions() {
    this.majorGridX = []
    this.minorGridX = []

    const naturalNotes = [
      { name: 'B', steps: 2 },
      { name: 'C', steps: 3 },
      { name: 'D', steps: 5 },
      { name: 'E', steps: 7 },
      { name: 'F', steps: 8 },
      { name: 'G', steps: 10 }
    ]

    for (let octave = 0; octave <= 7; octave++) {
      const freqA = 27.5 * Math.pow(2, octave)
      const pctA = Math.log(freqA / this.minFreq) / Math.log(this.maxFreq / this.minFreq)
      const xA = pctA * this.canvas.width

      if (xA >= 0 && xA <= this.canvas.width) {
        this.majorGridX.push({ x: xA, label: `A${octave}` })
      }

      naturalNotes.forEach(note => {
        const freqMinor = freqA * Math.pow(2, note.steps / 12)
        const pctMinor = Math.log(freqMinor / this.minFreq) / Math.log(this.maxFreq / this.minFreq)
        const xMinor = pctMinor * this.canvas.width
        if (xMinor >= 0 && xMinor <= this.canvas.width) {
          this.minorGridX.push(xMinor)
        }
      })
    }
  }

  public drawMultiRateSpectrum(
    highDetailData: Float32Array,
    standardData: Float32Array,
    mainSampleRate: number,
    bassSampleRate: number
  ) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    this.drawGrid()

    const width = this.canvas.width
    const height = this.canvas.height

    const mainNyquist = mainSampleRate / 2
    const bassNyquist = bassSampleRate / 2

    const barWidth = 2
    const gap = 1
    this.ctx.fillStyle = '#990000'

    const lowCrossfadeLimit = LOW_CUTOFF * 0.5

    for (let x = 0; x < width; x += (barWidth + gap)) {
      const pct = x / width
      const freq = this.minFreq * Math.pow(this.maxFreq / this.minFreq, pct)

      let amplitude = 0

      if (freq < lowCrossfadeLimit) {
        const bin = (freq * highDetailData.length) / bassNyquist
        amplitude = this.lerp(highDetailData, bin)
      }
      else if (freq >= lowCrossfadeLimit && freq <= LOW_CUTOFF) {
        const binLow = (freq * highDetailData.length) / bassNyquist
        const binStd = (freq * standardData.length) / mainNyquist

        const valLow = this.lerp(highDetailData, binLow)
        const valStd = this.lerp(standardData, binStd)

        const blend = (freq - lowCrossfadeLimit) / (LOW_CUTOFF - lowCrossfadeLimit)
        amplitude = (valLow * (1 - blend)) + (valStd * blend)
      }
      else {
        const bin = (freq * standardData.length) / mainNyquist
        amplitude = this.lerp(standardData, bin)
      }

      const minDB = -100
      const maxDB = -20
      let normalizedH = (amplitude - minDB) / (maxDB - minDB)
      normalizedH = Math.max(0, Math.min(1, normalizedH))

      const barHeight = normalizedH * height
      const y = height - barHeight

      this.ctx.fillRect(x, y, barWidth, barHeight)
    }
  }

  private lerp(data: Float32Array, binIndex: number): number {
    const low = Math.floor(binIndex)
    const high = Math.ceil(binIndex)
    const t = binIndex - low
    if (high >= data.length) return data[data.length - 1] || -100
    if (low < 0) return data[0] || -100
    return data[low] * (1 - t) + data[high] * t
  }
}