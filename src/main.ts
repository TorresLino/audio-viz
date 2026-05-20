// src/main.ts
import { AudioEngine } from './audioEngine';
import { Visualizer, SpectrumVisualizer } from './visualizer';

const canvas = document.querySelector<HTMLCanvasElement>('#viz-wave')!;
const startBtn = document.querySelector<HTMLButtonElement>('#start')!;
const specCanvas = document.querySelector<HTMLCanvasElement>('#viz-spectrum')!;

const engine = new AudioEngine();
const vizWave = new Visualizer(canvas);
const spectrumViz = new SpectrumVisualizer(specCanvas);

startBtn.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true
    });

    await engine.setSource(stream)

    render()
  } catch (err) {
    console.error("Capture failed or denied", err);
  }
});

function render() {
  const waveData = engine.getWaveformData();
  vizWave.draw(waveData);

  const { standardData, highDetailData } = engine.getMultiRateFrequencyData();
  const sampleRate = engine.getSampleRate();
  spectrumViz.drawMultiRateSpectrum(highDetailData, standardData, sampleRate);

  requestAnimationFrame(render);
}