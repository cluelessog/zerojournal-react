# zeroJournal v2

A local-first trading journal for Zerodha traders.

## Web Worker Parsing (Sprint 1)

File parsing now runs in a Web Worker to keep the UI responsive. The main thread stays smooth (60 FPS) while large Excel files are parsed in the background.

- Parse time: < 200ms (2,219 trades)
- Fallback: Synchronous parsing if Worker fails
- Main bundle: 405 KB smaller (no SheetJS, lazy Recharts)
