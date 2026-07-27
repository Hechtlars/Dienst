# Dienst – Web-App

Diese Version läuft als installierbare Web-App auf dem iPhone und benötigt weder Xcode noch ein Apple-Developer-Abo.

## Funktionen

- Dienst immer vom gewählten Datum 08:00 Uhr bis zum Folgetag 08:00 Uhr
- Einsätze „Telefonisch“ und „Im Haus“
- automatische Berechnung der Einsatzminuten
- Statistik je Dienst
- Monatsübersicht mit Datum, Anfangszeit, Endzeit und Minuten
- lokale Speicherung auf dem Gerät
- Offline-Nutzung nach dem ersten Laden
- Export und Import einer JSON-Datensicherung über das Drei-Punkte-Menü

## Kostenlos veröffentlichen

Die Dateien müssen über HTTPS bereitgestellt werden, damit Installation und Offline-Modus funktionieren. Am einfachsten ist ein kostenloser statischer Webhoster, z. B. GitHub Pages, Netlify oder Cloudflare Pages.

### Beispiel mit Netlify Drop

1. Den Ordner `Dienst-Web-App` entpacken.
2. Im Browser Netlify Drop öffnen.
3. Den kompletten Ordner auf die Seite ziehen.
4. Die erzeugte HTTPS-Adresse auf dem iPhone in Safari öffnen.
5. In Safari auf **Teilen** tippen.
6. **Zum Home-Bildschirm** wählen und **Hinzufügen** antippen.

## Wichtig zur Speicherung

Die Daten liegen lokal im Browser dieses iPhones. Sie bleiben beim normalen Schließen und Neustarten erhalten. Sie können jedoch verloren gehen, wenn die Web-App gelöscht, Safari-Websitedaten gelöscht oder das iPhone zurückgesetzt wird. Deshalb regelmäßig über **••• → Sicherung exportieren** eine Sicherungsdatei speichern.

Daten aus der bisherigen nativen iPhone-App werden nicht automatisch übernommen.


## Änderung: aufgerundete Dienststunden

In der Detailansicht eines Dienstes werden die Minuten für Telefonisch und Im Haus jeweils separat auf die nächste volle Stunde aufgerundet. Die beiden aufgerundeten Stundenwerte werden zusätzlich zu einer Gesamtsumme addiert.
