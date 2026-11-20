# Abyssal Knight

2D Action-Platformer (Soulslike / Metroidvania) на чистом JavaScript и HTML5 Canvas.

## Запуск игры

Для того чтобы браузер мог загружать аудиофайлы (`.wav`) без ограничений CORS локальной файловой системы (`file://`), запускайте игру через локальный сервер:

```bash
# Через npm / npx
npm start
# или
npx serve -l 3000 .

# Либо через встроенный Python
python3 -m http.server 3000
```

После этого откройте в браузере: `http://localhost:3000`
