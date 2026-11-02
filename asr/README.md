# 文字起こしサーバ（asr）

健診の録音を文字にする。自宅の GPU の機械で動かし、アプリのサーバから `ASR_URL` で呼ぶ。
音声は文字にしたらすぐ消す。

```bash
python3 -m venv ~/boshi-asr && ~/boshi-asr/bin/pip install faster-whisper
ASR_HOST=0.0.0.0 ~/boshi-asr/bin/python server.py   # 既定はモデル large-v3・ポート 8765
```

アプリ側は `app/.env.local` に `ASR_URL=http://<機械の住所>:8765` を書く。
