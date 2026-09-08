# Dienst – Version 6

Progressive Web App zur lokalen Erfassung von Bereitschaftsdiensten.

## Neu in Version 6

- Dienste in der Monatsansicht nach links wischen und löschen
- Langer Druck auf einen Dienst: Bearbeiten oder Löschen
- Einsätze antippen und nachträglich bearbeiten
- Einsätze nach links wischen und löschen
- Langer Druck auf einen Einsatz: Bearbeiten oder Löschen
- Festes Eingabefenster ohne horizontales Verschieben
- Nur vertikales Scrollen in längeren Formularen
- Kompakte Zusammenfassung jedes Dienstes in der Monatsansicht

Alle persönlichen Daten bleiben ausschließlich im lokalen Browser-Speicher des jeweiligen Geräts.


## Version 6.2
- Aktiver Dienst wird beim Öffnen/Zurückkehren aus dem Hintergrund sofort neu geprüft.
- Zusätzliche Prüfung alle 30 Sekunden, damit Dienstgrenzen ohne Neustart erkannt werden.
- Nach dem Anlegen eines Dienstes wird die Dienstansicht sofort erzwungen und aktualisiert.


## Version 6.3
- Beim Öffnen von „Einsatz hinzufügen“ wird die Endzeit standardmäßig auf 10 Minuten nach der Startzeit gesetzt.
- Die Endzeit kann weiterhin manuell geändert werden.


## Version 6.4
- Dienst-Datumsformular auf iPhones weiter oben positioniert.
- Optionale lokale Vergütungsanzeige über das Drei-Punkte-Menü.
- Zwei getrennte Stundensätze: Bereitschaftsstunden und Pauschalenbasis.
- Pauschale Mo–Fr 200 %, Sa/So 400 %.
- Vergütung pro Dienst und Monatsgesamtsumme.
- Lohnangaben bleiben ausschließlich lokal gespeichert und sind Bestandteil der manuellen Sicherungsdatei.


## Neu in Version 6.7
- PDF-Bericht zeigt jetzt alle Einsätze je Dienst.
- Berichtsvorschau mit Zurück-zur-App-Button und separatem PDF/Drucken-Button.
- Optionaler Zeitstrahl unter dem aktuellen Dienst; Krankenwagen zeigt den Fortschritt.
- Zeitstrahl unter ••• ein-/ausschaltbar.


## Version 7.0
- Individuelle Dienstzeiten pro Wochentag über das •••-Menü ein-/ausschaltbar.
- 8 Sekunden Rückgängig nach Löschen von Diensten oder Einsätzen.
- RTW oben links führt zur Seite Aktueller Bereitschaftsdienst.
- Zeitstrahl-RTW: größere Staubwolke, größer beim Antippen und minimales Wackeln im Ruhezustand.
- Service-Worker-Cache auf Version 7.0 aktualisiert.


## Version 7.2
- Monatsübersicht neu sortiert: Dienste, Gesamtstunden und Aufteilung Telefonisch/Im Haus.
- Untere Navigation: „Monat“ heißt jetzt „Übersicht“.


## Version 7.3
- Neues optionales Feld „Patienten-ID“ bei Einsatz erfassen und bearbeiten.
- Patienten-ID wird in Einsatzübersicht, CSV und PDF-Bericht ausgegeben.
- „Stundenlohn anzeigen“ und „Zeitstrahl anzeigen“ sind unter „Erweiterte Optionen“ versteckt.


## Version 7.4
- PDF-Vorschau auf dem iPhone responsiv überarbeitet.
- Keine seitliche Verschiebung der gesamten Ansicht mehr.
- Einsätze werden auf schmalen Displays als kompakte Karten dargestellt.
- Beim Drucken bzw. Erstellen des PDFs bleibt die Tabellenansicht erhalten.


## Version 7.5
- Patienten-ID ist bei neuen/zu bearbeitenden Einsätzen erforderlich: nur Ziffern, mindestens 9 Stellen.
- Kamera-Scan für Patienten-ID mit engem Scanbereich.
- OCR-Erkennung erfolgt im Browser; die App speichert kein Kamerabild.
- Gespeichert wird ausschließlich die erkannte Patienten-ID.
- Info-Button erklärt die datensparsame Scan-Funktion.


## Version 7.6
- Patienten-ID wieder optional.
- Ein Einsatz kann ohne Patienten-ID gespeichert werden.
- Wird eine Patienten-ID eingetragen oder gescannt, muss sie aus mindestens 9 Ziffern bestehen.


## Version 7.7
- Auch bei vergangenen Diensten können nachträglich Einsätze hinzugefügt werden.
- In der Detailansicht eines früheren Dienstes gibt es nun direkt „+ Einsatz hinzufügen“.
- Bereits vorhandene Einsätze können weiterhin durch Antippen bzw. über das Kontextmenü bearbeitet werden.
- Beim nachträglichen Hinzufügen werden Datum und Uhrzeit weiterhin gegen den Zeitraum des ausgewählten Dienstes geprüft.


## Version 7.8
- Patienten-ID-Scanner repariert: Die OCR-Bibliothek wird nun tatsächlich geladen.
- Automatische Erkennung startet nach Öffnen des Scanners und versucht die ID regelmäßig zu lesen.
- „Jetzt erfassen“ löst zusätzlich eine sofortige Erkennung aus.
- Der ausgewertete Kamerabereich entspricht dem sichtbaren Scanrahmen.
- Schonendere Bildaufbereitung statt harter Schwarz-Weiß-Umwandlung, insbesondere für IDs auf Monitoren.
- Scanner liegt als eigenes Overlay über dem Einsatzformular; vorhandene Formulardaten und Bearbeitungsfunktionen bleiben erhalten.
- Kein Foto wird gespeichert; temporäre Scanbilder werden nach jedem Erkennungsversuch verworfen.


## Version 7.9
- Scanner-Ebenenfehler behoben: Der Patienten-ID-Scanner wird als eigenes modales Browser-Dialogfenster in der obersten Ebene geöffnet.
- Die Maske „Einsatz erfassen/bearbeiten“ bleibt darunter erhalten, kann den Scanner aber nicht mehr überdecken.
- Nach Erkennung oder Abbruch erscheint das Einsatzformular wieder mit den bisherigen Eingaben.
- Die Raute am Patienten-ID-Feld wurde durch ein schlichtes monochromes Kamera-Symbol ersetzt.


## Version 7.10
- Im •••-/Mehr-Menü wird ganz unten die aktuell geladene App-Version angezeigt.
- Beispiel: „Dienst · Version 7.10“.
- Damit lässt sich nach einem GitHub-Update direkt prüfen, ob das Gerät bereits die neue Version geladen hat.


## Version 7.11
- Patienten-ID-OCR gezielt anhand des gemeldeten Monitor-Beispiels verbessert.
- Primäre Texterkennung von Tesseract PSM 7 auf PSM 13 umgestellt.
- Falls die erste Erkennung keine ID liefert, erfolgt automatisch ein zweiter Versuch mit Schwarz-Weiß-Aufbereitung und PSM 8.
- Nur Zahlenfolgen ab 9 Ziffern werden übernommen.


## Version 7.12
- Erkannte Patienten-ID wird nach erfolgreichem Scan zuverlässig in das Patienten-ID-Feld übernommen.
- Scanner schließt sich anschließend automatisch und kehrt zur Einsatzmaske zurück.
- Zusätzliche input/change-Events sorgen insbesondere unter iOS/Safari dafür, dass die übernommene ID im Formular erhalten bleibt.
- Scanrahmen und tatsächlich ausgewerteter Bildbereich wurden etwas vergrößert, damit die Ziffern nicht mehr ganz so exakt positioniert werden müssen.


## Version 7.13
- Sicherheitslogik des Patienten-ID-Scanners verschärft.
- Getrennt erkannte Ziffernfragmente werden nicht mehr zu einer vermeintlichen ID zusammengesetzt.
- Eine ID muss als zusammenhängende Zahlenfolge mit mindestens 9 Ziffern erkannt werden.
- Dieselbe ID muss in zwei Erkennungsdurchläufen übereinstimmen.
- Danach wird die erkannte Nummer groß angezeigt und muss mit „Übernehmen“ bestätigt werden.
- „Erneut scannen“ verwirft den Treffer.
- Der Scanbereich bleibt breit, wurde vertikal aber wieder enger auf die eigentliche ID-Zeile begrenzt.


## Version 7.14
- Grundlegender Scanner-Fix für iPhone/Safari: Der sichtbare weiße Scanrahmen wird nun pixelgenau auf den tatsächlich ausgewerteten Bereich des Kamera-Rohbilds abgebildet.
- Das durch `object-fit: cover` entstehende Zuschneiden des Kamerabilds wird bei der OCR-Koordinatenberechnung berücksichtigt.
- Dadurch verarbeitet die OCR jetzt wirklich genau den Bereich, den der Nutzer im Rahmen sieht.
- Der Scanbereich ist etwas höher und breiter, ohne umliegende Bildbereiche unnötig einzubeziehen.
- Für denselben exakten Bildausschnitt werden mehrere OCR-Varianten verwendet (Graustufen + zwei Schwellenwerte).
- Eine ID gilt erst als sicher, wenn sie innerhalb desselben Bildes mehrfach identisch erkannt wird und zusätzlich in einem weiteren Kameraframe bestätigt wurde.
- Getrennte Ziffernfragmente werden weiterhin niemals zu einer ID zusammengesetzt.
- Vor Übernahme bleibt die manuelle Bestätigung der erkannten Patienten-ID bestehen.


## Version 7.15
- Scanner auf größere Kameraentfernung optimiert, damit die iPhone-Kamera nicht mehr in den unscharfen Nahbereich gezwungen wird.
- Höhere gewünschte Kameraauflösung (bis 4K, sofern vom Gerät/Browser unterstützt).
- Kontinuierlicher Fokus und moderater digitaler Zoom werden verwendet, sofern Safari/iOS dies unterstützt.
- Deutlich größerer sichtbarer Scanrahmen.
- Der Scanner prüft mehrere leicht versetzte Teilbereiche innerhalb des Rahmens, damit die ID nicht exakt zentriert werden muss.
- Stärkere digitale Vergrößerung und moderate Schärfung vor der OCR.
- Sicherheitslogik bleibt erhalten: nur zusammenhängende IDs ab 9 Ziffern, mehrfach übereinstimmende Erkennung und Bestätigung vor Übernahme.


## Version 7.16
- Live-OCR wurde durch einen gezielten Einzelbild-Scan ersetzt.
- Nach „Foto erfassen“ versucht die App, über `ImageCapture.takePhoto()` ein echtes hochauflösendes Kamerafoto zu verwenden; falls der Browser dies nicht unterstützt, wird auf den aktuellen Videoframe zurückgefallen.
- Der sichtbare Scanrahmen wird auf das aufgenommene Einzelbild zurückgerechnet.
- Innerhalb des Rahmens werden mehrere leicht versetzte Teilbereiche geprüft.
- Die Ausschnitte werden stark hochskaliert und in mehreren OCR-Varianten ausgewertet.
- Eine ID wird nur übernommen, wenn sie innerhalb der Erkennung mehrfach übereinstimmt.
- Das Einzelbild wird nicht gespeichert, sondern nur kurzfristig im Arbeitsspeicher verarbeitet und anschließend verworfen.


## Version 7.19
- Rückkehr zur funktionierenden Tesseract-Basis aus Version 7.16.
- PaddleOCR wurde nicht übernommen.
- Neu: Nach „Foto erfassen“ zeigt der Scanner direkt den exakten Bildausschnitt an, der tatsächlich an die OCR weitergegeben wird.
- Dadurch lässt sich erstmals eindeutig unterscheiden, ob der Fehler beim Kamera-/Rahmen-Zuschnitt oder bei der eigentlichen Ziffernerkennung entsteht.
- Die Vorschau wird nur temporär im Browser angezeigt und nicht gespeichert.
- Sicherheitsbestätigung vor Übernahme der Patienten-ID bleibt bestehen.
