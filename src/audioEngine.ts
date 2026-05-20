export class AudioEngine {
  private audioCtx: AudioContext;
  private source: MediaStreamAudioSourceNode | null = null;

  // Existing nodes for Waveform & General Viz
  private analyser: AnalyserNode;
  private filter: BiquadFilterNode;

  // NEW: Specialized branch for High-Detail Bass
  private bassAnalyser: AnalyserNode;
  private bassFilter: BiquadFilterNode;

  constructor() {
    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

    // --- Waveform Branch ---
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 2048; // Standard size for snappy waveform visuals
    this.analyser.smoothingTimeConstant = 0.6;

    this.filter = this.audioCtx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 500;

    // --- High-Detail Bass Branch (Option 3) ---
    this.bassAnalyser = this.audioCtx.createAnalyser();
    this.bassAnalyser.fftSize = 16384; // Massive buffer for high bass resolution
    this.bassAnalyser.smoothingTimeConstant = 0.4;

    this.bassFilter = this.audioCtx.createBiquadFilter();
    this.bassFilter.type = 'lowpass';
    this.bassFilter.frequency.value = 1000; // Focus resolution below 1kHz
  }

  public async setSource(stream: MediaStream) {
    if (this.audioCtx.state !== 'running') {
      await this.audioCtx.resume();
    }

    if (this.source) {
      this.source.disconnect();
    }

    this.source = this.audioCtx.createMediaStreamSource(stream);

    // 1. Path to Speakers (Clean)
    this.source.connect(this.audioCtx.destination);

    // 2. Path to Standard Waveform (Filtered)
    this.source.connect(this.filter);
    this.filter.connect(this.analyser);

    // 3. Path to High-Detail Bass Branch (New)
    this.source.connect(this.bassFilter);
    this.bassFilter.connect(this.bassAnalyser);

    return new Promise<void>((resolve) => {
      if (this.audioCtx.state === 'running') resolve();
      else {
        this.audioCtx.addEventListener('statechange', () => {
          if (this.audioCtx.state === 'running') resolve();
        }, { once: true });
      }
    });
  }

  // Used for the Waveform (keeps existing logic working)
  public getWaveformData(): Float32Array {
    const dataArray = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(dataArray);
    return dataArray;
  }

  // Returns both datasets for the "Stitched" Spectrum
  public getMultiRateFrequencyData() {
    const standardData = new Float32Array(this.analyser.frequencyBinCount);
    const highDetailData = new Float32Array(this.bassAnalyser.frequencyBinCount);

    this.analyser.getFloatFrequencyData(standardData);
    this.bassAnalyser.getFloatFrequencyData(highDetailData);

    return { standardData, highDetailData };
  }

  public getSampleRate(): number {
    return this.audioCtx.sampleRate;
  }

  public updateFilter(freq: number) {
    // We update the main visual filter
    this.filter.frequency.setTargetAtTime(freq, this.audioCtx.currentTime, 0.1);
  }
}