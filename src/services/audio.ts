export interface RecordingResult {
  blob: Blob;
  durationSec: number;
}

export class AudioRecorderService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private startTime: number = 0;
  private timerInterval: any = null;
  private recording: boolean = false;
  private onTickCallback?: (durationSec: number) => void;

  public isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof MediaRecorder !== 'undefined'
    );
  }

  public isRecording(): boolean {
    return this.recording;
  }

  public setOnTickCallback(callback: (durationSec: number) => void): void {
    this.onTickCallback = callback;
  }

  public async startRecording(): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('Audio recording MediaRecorder API is not supported in this browser.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioChunks = [];

    // Prioritize webm with opus compression, fallback to default
    let mimeType = 'audio/webm;codecs=opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : '';
    }

    this.mediaRecorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.startTime = Date.now();
    this.recording = true;
    this.mediaRecorder.start(250); // Slice every 250ms

    this.timerInterval = setInterval(() => {
      if (this.onTickCallback) {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        this.onTickCallback(elapsed);
      }
    }, 1000);
  }

  public stopRecording(): Promise<RecordingResult> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        this.cleanup();
        reject(new Error('No active recording in progress.'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const durationSec = Math.max(1, Math.floor((Date.now() - this.startTime) / 1000));
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.audioChunks, { type: mimeType });

        // Stop all tracks to release mic hardware
        this.mediaRecorder?.stream.getTracks().forEach((track) => track.stop());

        this.cleanup();
        resolve({ blob, durationSec });
      };

      this.mediaRecorder.stop();
    });
  }

  private cleanup(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.recording = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
  }
}

export const audioRecorderService = new AudioRecorderService();
