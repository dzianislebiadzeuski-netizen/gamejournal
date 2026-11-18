# GameJournal

Личный дневник геймера для Android: что прошёл, что бросил, что впереди, часы и статистика.
Все данные хранятся только на телефоне.

**Скачать последнюю версию:** раздел Releases → `GameJournal.apk`.

## Как устроено

- Web-приложение (Vite + Preact) внутри Capacitor 8 → нативный APK.
- Данные: JSON-файл в приватной папке приложения (+ предыдущая версия как страховка), резервная копия — экспорт в файл.
- Игры, обложки, жанры, похожие: IGDB API (ключ Twitch вводится в приложении).
- Время прохождения: HowLongToBeat (неофициально, best-effort), запасной вариант — IGDB time-to-beat.
- Перевод описаний: Google ML Kit на устройстве.
- Сборка APK: GitHub Actions (`.github/workflows/build.yml`) на каждый push в `main`, подпись постоянным ключом из секретов `KEYSTORE_B64` / `KEYSTORE_PASSWORD`.

## Разработка

```bash
npm install
npm run dev        # веб-версия для проверки интерфейса (без IGDB из-за CORS)
npm run build && npx cap sync android
```
