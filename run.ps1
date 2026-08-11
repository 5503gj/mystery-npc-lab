$env:MYSTERY_MODEL = if ($env:MYSTERY_MODEL) { $env:MYSTERY_MODEL } else { "qwen2.5:latest" }
python .\server.py
