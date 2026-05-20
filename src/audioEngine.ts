export const LOW_CUTOFF = 500
const MIN_SAMPLE_RATE = 4096

export class AudioEngine {
  private mainContext: AudioContext
  private mainSource: MediaStreamAudioSourceNode | null = null
  private mainOutput: MediaStreamAudioDestinationNode

  private mainAnalyser: AnalyserNode
  private mainFilter: BiquadFilterNode

  private bassContext: AudioContext
  private bassSource: MediaStreamAudioSourceNode

  private bassAnalyser: AnalyserNode
  private bassFilter: BiquadFilterNode

  constructor() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    this.mainContext = new AudioContextClass()
    this.mainOutput = this.mainContext.createMediaStreamDestination()

    this.mainFilter = this.mainContext.createBiquadFilter()
    this.mainFilter.type = 'lowpass'
    this.mainFilter.frequency.value = 5000

    this.mainAnalyser = this.mainContext.createAnalyser()
    this.mainAnalyser.fftSize = 2048
    this.mainAnalyser.smoothingTimeConstant = 0.6

    this.mainFilter.connect(this.mainAnalyser)

    const targetBassSampleRate = Math.max(MIN_SAMPLE_RATE, LOW_CUTOFF * 2)
    this.bassContext = new AudioContextClass({ sampleRate: targetBassSampleRate })
    this.bassSource = this.bassContext.createMediaStreamSource(this.mainOutput.stream)

    this.bassFilter = this.bassContext.createBiquadFilter()
    this.bassFilter.type = 'lowpass'
    this.bassFilter.frequency.value = LOW_CUTOFF * 1.1
    this.bassFilter.Q.value = 1

    this.bassAnalyser = this.bassContext.createAnalyser()
    this.bassAnalyser.fftSize = 1024
    this.bassAnalyser.smoothingTimeConstant = 0.2

    this.bassSource.connect(this.bassFilter)
    this.bassFilter.connect(this.bassAnalyser)
  }

  public async setSource(stream: MediaStream) {
    if (this.mainContext.state !== 'running') {
      await this.mainContext.resume()
    }
    if (this.bassContext.state !== 'running') {
      await this.bassContext.resume()
    }

    if (this.mainSource) {
      this.mainSource.disconnect()
      this.mainSource = null
    }

    this.mainSource = this.mainContext.createMediaStreamSource(stream)

    this.mainSource.connect(this.mainContext.destination)
    this.mainSource.connect(this.mainOutput)
    this.mainSource.connect(this.mainFilter)

    return new Promise<void>((resolve) => {
      if (this.mainContext.state === 'running') resolve()
      else {
        this.mainContext.addEventListener('statechange', () => {
          if (this.mainContext.state === 'running') resolve()
        }, { once: true })
      }
    })
  }

  public getWaveformData(): Float32Array {
    const dataArray = new Float32Array(this.mainAnalyser.fftSize)
    this.mainAnalyser.getFloatTimeDomainData(dataArray)
    return dataArray
  }

  public getMultiRateFrequencyData() {
    const standardData = new Float32Array(this.mainAnalyser.frequencyBinCount)
    const highDetailData = new Float32Array(this.bassAnalyser.frequencyBinCount)

    this.mainAnalyser.getFloatFrequencyData(standardData)
    this.bassAnalyser.getFloatFrequencyData(highDetailData)

    return { standardData, highDetailData }
  }

  public getSampleRate(): number {
    return this.mainContext.sampleRate
  }

  public getLowSampleRate(): number {
    return this.bassContext.sampleRate
  }

  public updateFilter(freq: number) {
    this.mainFilter.frequency.setTargetAtTime(freq, this.mainContext.currentTime, 0.1)
  }
}
