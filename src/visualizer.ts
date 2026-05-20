// src/visualizer.ts

export class Visualizer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;

  constructor(canvasElement: HTMLCanvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d')!;
  }

  public draw(data: Float32Array) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    this.ctx.lineWidth = 2
    this.ctx.strokeStyle = '#990000'
    this.ctx.beginPath()

    const sliceWidth = this.canvas.width / data.length;
    let x = 0;

    for (let i = 0; i < data.length; i++) {
      const v = data[i]
      const y = (v * (this.canvas.height / 2)) + (this.canvas.height / 2)

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    this.ctx.stroke();
  }
}

export class SpectrumVisualizer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  // Note: labelContainer is no longer strictly needed for labels, 
  // but we'll keep the constructor signature or just remove it.

  private readonly minFreq = 27.5; 
  private readonly maxFreq = 4186.0;

  private majorGridX: {x: number, label: string}[] = []; 
  private minorGridX: number[] = []; 

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.calculateGridPositions();
  }

  private drawGrid() {
    this.ctx.save();
    
    // 1. Set font styles for labels
    this.ctx.font = '10px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';

    // 2. Draw Minor Lines (C, D, E, F, G, B)
    this.ctx.strokeStyle = 'rgba(153, 0, 0, 0.08)'; 
    this.minorGridX.forEach(x => {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    });

    // 3. Draw Major Lines (A octaves) + Text Labels
    this.majorGridX.forEach(item => {
      // Draw the line
      this.ctx.strokeStyle = 'rgba(153, 0, 0, 0.3)';
      this.ctx.lineWidth = 1.5;
      this.ctx.setLineDash([5, 5]);
      this.ctx.beginPath();
      this.ctx.moveTo(item.x, 0);
      this.ctx.lineTo(item.x, this.canvas.height - 15); // Leave room for text
      this.ctx.stroke();

      // Draw the Text Label
      this.ctx.setLineDash([]); // Reset dash for text
      this.ctx.fillStyle = 'rgba(153, 0, 0, 0.8)';
      this.ctx.fillText(item.label, item.x, this.canvas.height - 12);
    });

    this.ctx.restore();
  }

  // Called once in constructor or on resize
  private calculateGridPositions() {
    this.majorGridX = [];
    this.minorGridX = [];

    const naturalNoteRatios = [
      { name: 'B', ratio: 1.12246 },
      { name: 'C', ratio: 1.18921 },
      { name: 'D', ratio: 1.33484 },
      { name: 'E', ratio: 1.49831 },
      { name: 'F', ratio: 1.58740 },
      { name: 'G', ratio: 1.78180 }
    ];

    for (let octave = 0; octave <= 7; octave++) {
      const freqA = 27.5 * Math.pow(2, octave);
      const pctA = Math.log(freqA / this.minFreq) / Math.log(this.maxFreq / this.minFreq);
      const xA = pctA * this.canvas.width;

      if (xA >= 0 && xA <= this.canvas.width) {
        this.majorGridX.push({ x: xA, label: `A${octave}` });
      }

      naturalNoteRatios.forEach(note => {
        const freqMinor = freqA * note.ratio;
        const pctMinor = Math.log(freqMinor / this.minFreq) / Math.log(this.maxFreq / this.minFreq);
        const xMinor = pctMinor * this.canvas.width;
        if (xMinor >= 0 && xMinor <= this.canvas.width) {
          this.minorGridX.push(xMinor);
        }
      });
    }
  }

  public drawMultiRateSpectrum(highDetailData: Float32Array, standardData: Float32Array, sampleRate: number) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw grid and labels FIRST
    this.drawGrid();
    
    const width = this.canvas.width;
    const height = this.canvas.height;
    const nyquist = sampleRate / 2;
    
    const barWidth = 2;
    const gap = 1;
    this.ctx.fillStyle = '#990000';

    for (let x = 0; x < width; x += (barWidth + gap)) {
      const pct = x / width;
      const freq = this.minFreq * Math.pow(this.maxFreq / this.minFreq, pct);
      
      let amplitude = 0;

      if (freq < 400) {
        const bin = (freq * highDetailData.length) / nyquist;
        amplitude = this.lerp(highDetailData, bin);
      } 
      else if (freq >= 400 && freq <= 600) {
        const binLow = (freq * highDetailData.length) / nyquist;
        const binStd = (freq * standardData.length) / nyquist;
        const valLow = this.lerp(highDetailData, binLow);
        const valStd = this.lerp(standardData, binStd);
        const blend = (freq - 400) / 200; 
        amplitude = (valLow * (1 - blend)) + (valStd * blend);
      } 
      else {
        const bin = (freq * standardData.length) / nyquist;
        amplitude = this.lerp(standardData, bin);
      }

      const minDB = -100;
      const maxDB = -20;
      let normalizedH = (amplitude - minDB) / (maxDB - minDB);
      normalizedH = Math.max(0, Math.min(1, normalizedH));

      const barHeight = normalizedH * height;
      const y = height - barHeight;

      this.ctx.fillRect(x, y, barWidth, barHeight);
    }
  }

  private lerp(data: Float32Array, binIndex: number): number {
    const low = Math.floor(binIndex);
    const high = Math.ceil(binIndex);
    const t = binIndex - low;
    if (high >= data.length) return data[low] || -100;
    return data[low] * (1 - t) + data[high] * t;
  }
}