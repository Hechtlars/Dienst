# Dienst – Version 7.50

Statische Web-App für Rufbereitschaft nach AVR-Caritas Anlage 30. Kein Build und kein Server für persönliche Daten erforderlich. Grundlage: Version 7.37.

## Direkte Updates über GitHub

Änderungen können direkt im bestehenden Repository Hechtlars/Dienst vorgenommen werden. Manuelles Entpacken und Hochladen von ZIP-Dateien ist für diesen Ablauf nicht erforderlich. Die öffentliche Adresse bleibt https://hechtlars.github.io/Dienst/.

Der Workflow „Dienst prüfen und veröffentlichen“ führt auf GitHub zunächst Syntax-, Tarif-, Berechnungs-, Migrations- und Browserprüfungen aus. Die Browserprüfung verwendet Chromium und WebKit und kontrolliert Bedienung, Sicherungen, mobiles Layout und Offline-Verhalten. Nur nach erfolgreichen Prüfungen wird die Website aus main veröffentlicht. Danach kontrolliert ein weiterer Browserlauf die tatsächliche Live-Version, Dienstanlage und lokale Speicherung. Fehlgeschlagene Prüfungen vor dem Veröffentlichen belassen die bisherige Live-Version.

GitHub Pages verwendet dafür die Quelle **GitHub Actions**. Die Pipeline übernimmt ausschließlich die öffentlichen Website-Dateien; Tests, Abhängigkeiten und persönliche Sicherungen gehören nicht zum veröffentlichten Website-Paket. Prüfergebnisse und Screenshots sind beim jeweiligen GitHub-Actions-Durchlauf abrufbar.

Vor Änderungen weiterhin eine lokale Sicherung exportieren. Die App lädt danach ihre neue Version; falls angezeigt, „Aktualisieren“ antippen. Persönliche Daten bleiben im Browser und werden durch diesen Veröffentlichungsablauf nicht synchronisiert.

Keine Abrechnungs-PDFs oder persönlichen Sicherungen in GitHub hochladen. Dieses Paket enthält keine hochgeladenen Abrechnungen oder Patientendaten.

## Änderungen

- Version 7.50 ergänzt ausschließlich für „Im Haus“ einen laufenden Einsatz: Beim Losfahren genügt „Im Haus starten“, beim Zurückkehren „Haus-Einsatz beenden“. Es wird keine fiktive Endzeit gespeichert. Offene Hauseinsätze bleiben lokal erhalten, werden deutlich markiert und erst nach dem Beenden in Einsatzstunden und Vergütung einbezogen. Telefonate bleiben unverändert mit der 10-Minuten-Vorgabe. PWA-Cache auf 7.50 erhöht.

- Version 7.49 schließt jeden offenen App-Dialog bei Tipp auf den sichtbaren abgedunkelten Rand. Das entspricht „Abbrechen“; es werden keine Eingaben gespeichert. PWA-Cache auf 7.49 erhöht.

- Version 7.48 zeigt die Auswahl „Gesamtes Wochenende anlegen“ ausschließlich bei Freitag, Samstag oder Sonntag. Sie legt Freitag bis Sonntag als drei getrennte Dienste an; an Werktagen bleibt sie vollständig verborgen. Die iPhone-Darstellung der Auswahl ist kompakt korrigiert. PWA-Cache auf 7.48 erhöht.

- Version 7.47 entfernt den Button „Dienst bearbeiten“ von der Startseite und verschiebt den Speicherhinweis in „Mehr → Datensicherung“. Bearbeiten bleibt in der Monatsübersicht und Dienstdetailansicht erreichbar.

- Version 7.46 setzt die Standard-Anfangszeiten für neue Dienste auf Montag bis Freitag 15:45 Uhr sowie Samstag und Sonntag 10:30 Uhr. Bereits gespeicherte Dienste und individuell konfigurierte Zeiten bleiben unverändert. Ein für heute angelegter, aber noch nicht begonnener Dienst wird auf der Startseite als „Heutige Rufbereitschaft geplant“ mit Beginnzeit angezeigt. PWA-Cache auf 7.46 erhöht.

- Version 7.45 ergänzt beim Anlegen eines Freitagsdienstes die ausdrücklich wählbare Option, Samstag und Sonntag ebenfalls anzulegen. Es entstehen drei vollständig getrennte Dienste mit den jeweiligen Tageszeiten; sie werden weiterhin separat gezählt, berechnet, exportiert und können einzeln bearbeitet oder gelöscht werden. Wenn bereits ein Teil des Wochenendes vorhanden ist, legt die App keinen unvollständigen Block an. PWA-Cache auf 7.45 erhöht.

- Version 7.44 korrigiert die bestätigte historische Periode für August 2026: Nur beim belegten Profil Fachärztin/Facharzt II, Stufe 1 und den bereits gespeicherten Werten 50,96 € / 43,42 € wird eine fehlende Tarifperiode ab März 2026 mit Zuschlagsbasis 50,26 € und bestätigtem Status ergänzt. Davon abweichende oder vorhandene Tarifperioden bleiben unverändert. Die AiRB-/RB-00–06-Einzelvergütung rundet die bewerteten 50%-Stunden vor der Multiplikation; die zwei August-Einsätze ergeben damit zusammen 83,06 € wie die geprüfte Abrechnung. Nicht aus den verfügbaren Einsatzdaten ableitbare Zeit-Zuschläge werden weiterhin nicht als gesicherte Ansprüche behauptet. PWA-Cache auf 7.44 erhöht.

- Version 7.43 ergänzt die AVR-Anlage-30-Auswahl: Ärztin/Arzt (Assistenzarzt) I mit Stufe 1–6, Fachärztin/Facharzt II mit Stufe 1–6, Oberärztin/Oberarzt III mit Stufe 1–3 und leitende Oberärztin/leitender Oberarzt IV mit Stufe 1–2. Vollständig verifizierte NRW-Referenzwerte ab März 2026 können übernommen werden; für nicht vollständig belegte Kombinationen wird kein automatischer Anspruch berechnet. Tarifhistorie bleibt unverändert. PWA-Cache auf 7.43 erhöht.

- Version 7.42 macht die bisherige Option verständlich und direkt erreichbar: „Vergütung anzeigen“ blendet alle Berechnungen und Beträge in den Dienst- und Monatsansichten gerätebezogen ein oder aus. Tarifwerte und die vorhandene Historie bleiben dabei gespeichert. PWA-Cache auf 7.42 erhöht.

- Version 7.41 richtet direkte Updates mit vorgeschalteten Prüfungen und anschließender Live-Kontrolle ein. Eine fehlgeschlagene Updateprüfung beim Offline-Neustart wird abgefangen. Der Fehler wurde durch die echte Browserprüfung gefunden; PWA-Cache auf 7.41 erhöht.

- Version 7.40 stellt den kompakten Dienst-Dialog wieder her: Datum wählen und speichern; Beginn und Ende werden aus den Wochentagsvorgaben bzw. den individuellen Einstellungen übernommen. Keine zusätzlichen Uhrzeitfelder. Dialoginhalte können innerhalb der verfügbaren Höhe scrollen. Bereits gespeicherte abweichende Dienstzeiten bleiben erhalten. Bei unverändertem Datum werden auch beim Bearbeiten die vorhandenen Grenzen beibehalten; bei Datumänderung gelten die Vorgaben des neuen Wochentags, und Einsätze werden wie bisher mitverschoben und geprüft. PWA-Cache auf 7.40 erhöht.
- Version 7.39 korrigiert die verschobene Monatsvergütung: Titel und Betrag, Aufschlüsselung sowie Tarifhinweise erhalten getrennte Zeilen. Auf schmalen Displays steht der Betrag unter dem Titel. Lange Einzelvergütungstexte können umbrechen. PWA-Cache auf 7.39 erhöht.
- Bestehende Vergütungsengine erweitert: historische Zuschlagsfenster, Zuschlagskonkurrenz, RB-Staffelung, kurze RB unter zwölf Stunden, Einzelbeträge und Brutto-Soll-Ist-Abgleich.
- Feiertagskorrektur des Nutzers: mit Freizeitausgleich, 35 %. Bestehende Tarifperioden werden einmalig entsprechend korrigiert, ihre Stundenwerte bleiben erhalten.
- Bestätigtes Profil: Entgeltgruppe II, Stufe 1. Fehlender Zeitraum ab März 2026 wird bei den bisherigen Standardsätzen mit 50,96 Euro Einsatzstundenwert, 43,42 Euro Pauschalenbasis und 50,26 Euro Zuschlagsbasis ergänzt. Bereits gespeicherte neuere Tarifperioden werden nicht überschrieben.
- Referenzvorschläge NRW berücksichtigen den ersten Tabellenanstieg erst ab November 2025, anschließend Dezember 2025 und März 2026.
- Telefonzeiten pro Dienst gemeinsam aufgerundet; Hauseinsätze einzeln. Einzelbeträge bei Telefonaten sind ausdrücklich Anteile am gemeinsamen Telefonpool.
- RB-Kernnacht: eigene Mindestrundung unter einer Stunde; Zusatz AiRB und zusätzliche Zeitanteile entsprechend den Lohnartengruppen getrennt dargestellt.
- Gehaltsvergleich speichert Leistungsmonat und Auszahlungsmonat getrennt; Auszahlungsvorschlag Folgemonat. Istwerte werden lokal gespeichert und mitgesichert.
- Alte Dienstzeiten bei Migration eingefroren; spätere Einstellungen wirken als Vorgabe für neue Dienste. Individuelle Wochentagszeiten bleiben in den Einstellungen konfigurierbar.
- PDF-Bericht enthält Vergütungsdetails und lokale Patienten-ID-Ausschnitte; CSV enthält Einzelbeträge und Status.
- Veralteter Kamera-Aufruf beim Schließen des Dialogs repariert, Kamerastream und vollständiges temporäres Foto werden beim Schließen verworfen.
- Cache-Version aktualisiert, fremde Cache-Namen werden beim Update erhalten. Speicherausfälle werden sichtbar gemeldet.

## Transparenz der Berechnung

Alle Zahlen sind Bruttowerte. Die App prüft Rufbereitschaftspositionen, nicht das gesamte Nettogehalt. Keine Bereitschaftsdienstbewertung nach § 8.

Die RB-Staffelung braucht den Beschäftigungsumfang und einen als vollständig bestätigten Leistungsmonat. Ungeklärte Staffelzuschläge werden nicht addiert. Normale Grenze: 13 RB, danach 10 %, weitere drei RB jeweils weitere 10 Prozentpunkte; bei Teilzeit wird die Grenze entsprechend angepasst.

Dienste über 24 Stunden werden nicht automatisch in mehrere tarifliche RB umgedeutet. Ihre Starttagspauschale bleibt ein ausdrücklich vorläufiger Vergleichswert; die Staffelung ist bei ungeklärter Zählung ausgesetzt. Das betrifft insbesondere die bisherige Freitagsvorgabe von 25 Stunden 15 Minuten.

Bei fehlender historischer Zuschlagsbasis, ungeklärtem Profil, Tarifwechsel innerhalb eines Dienstes und Zeiträumen ab 2027 erscheint eine Begründung. Fehlende Zuschlagsbeträge werden nicht als gesicherte Ansprüche ausgegeben. Zuschläge wegen verspäteter Planung, kurzfristiger Planänderung oder fehlender freier Wochenenden sind ohne Nachweise nicht automatisch enthalten.

Angezeigte Abrechnungsstunden und Stundensätze können intern genauer sein. Der geprüfte Feiertagsbetrag von 108,53 Euro weicht bei Rechnung mit den angezeigten Werten um einen Cent ab. Eine exakte Reproduktion der internen Abrechnungsrundung ist nicht bestätigt. Der Istwert wird nicht künstlich an den Sollwert angepasst.

## Tests und Grenzen

70 automatisierte Prüfungen bestanden: Tarif-, Berechnungs-, Migrationstests und Funktionsprüfungen der Formularhandler im Node-DOM-Testhost. Einschließlich Anlegen allein per Datum für alle Wochentage, individuelle Zeitvorgaben, Duplikatprüfung, fehlendes Datum, Bearbeiten, Verschieben und Zurückweisen nicht passender Einsätze ohne Datenverlust. JavaScript-Syntax, lokale Asset-Verweise und ZIP-Struktur geprüft. Ergebnisse in tests/core-results.json.

**Browserprüfung durchgeführt:** Der GitHub-Actions-Durchlauf vom 10. Oktober 2026 hat 156 Prüfpositionen in Chromium (Desktop und mobil) sowie WebKit (mobil) ohne Fehler abgeschlossen. Dazu gehören Tarifberechnung, Migration, Dienstanlage per Datum, Einsatzbearbeitung, Gehaltsvergleich, CSV/PDF-Bericht, Backup-Export/Import, Löschen und Wiederherstellen, Fotoausschnitt, Layout bei 320/390/430/768 Pixeln und Offline-Neustart. Ergebnisse in tests/results.json und beim jeweiligen GitHub-Actions-Durchlauf. Physische Kamera-Hardware, der native iPhone-Druckdialog und das Update einer bereits installierten iPhone-PWA sind damit weiterhin nicht auf einem echten Gerät geprüft. Die UI-Tests ersetzen keine abschließende Bestätigung ungeklärter Tarifregeln.

Berechnungstests vom Projektstamm: `node tests/core.cjs`. Browsertests: `npm ci`, `npx playwright install --with-deps chromium webkit`, anschließend `npm run test:browser`. Der Test startet und beendet seinen lokalen Testserver selbst. Live-Test: `LIVE_URL=https://hechtlars.github.io/Dienst/ node tests/live.cjs`.

## Tarifquellen (geprüft Oktober 2026)

- Bundeskommission, 5. Juni 2025: https://caritas-dienstgeber.de/fileadmin/Beschluesse/BK/01_BK_2025-02_Beschluss_Tarifrunde_AErzte_2024_bis_2026_gezeichnet.pdf
- NRW-Umsetzung: https://www.akmas.de/tarif/tarifrunde-aerzte-2024/rk-nrw-einigung-in-der-tarifrunde-f%C3%BCr-%C3%A4rztinnen-und-%C3%A4rzte.html
- Kirchliches Amtsblatt Essen 9/2022, RB-Staffel/Kernnacht: https://www.bistum-essen.de/fileadmin/relaunch/Bilder/Service/Amtsblatt_2022/Kirchliches_Amtsblatt_Essen_9_2022.pdf
- Anlage 30, frühere Grundregeln: https://www.diag-mav-freiburg.de/media/download/variant/831047/


# Frühere Versionshistorie

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


## Version 7.20
- Aufbauend auf dem erfolgreichen Diagnosebild aus 7.19.
- Kamera-Mapping bleibt unverändert, da der tatsächlich ausgewertete Ausschnitt korrekt war.
- Tesseract untersucht jetzt zuerst mehrere enge, mittig liegende Zahlenbereiche statt die komplette Bildschirmzeile.
- Symbole links/rechts werden dadurch bewusst abgeschnitten.
- Tesseract bleibt auf Ziffern 0–9 beschränkt und erhält zusätzlich Numeric-Mode.
- Weniger aggressives Upscaling, um Monitor-Moiré/Pixelfehler nicht unnötig zu verstärken.
- Mehrere OCR-Modi und Bildvarianten werden verglichen.
- Eine Patienten-ID wird nur angeboten, wenn mehrere unabhängige OCR-Durchläufe dieselbe vollständige Zahlenfolge liefern.
- Die Vorschau zeigt nun den engsten Zahlenbereich, der tatsächlich zuerst ausgewertet wird.


## Version 7.21
- Versions- und Cache-Bump auf 7.21.
- Scanner-Funktion entspricht technisch Version 7.20.
- Keine zusätzlichen funktionalen Änderungen.


## Version 7.22
- Behebt das Hängenbleiben bei „Patienten-ID wird lokal erkannt …“.
- Jeder einzelne Tesseract-Erkennungslauf hat jetzt einen harten Timeout von 12 Sekunden.
- Der Foto-Button wird nach Erfolg, Fehler oder Timeout zuverlässig wieder freigegeben.
- Weniger OCR-Durchläufe pro Aufnahme, damit iPhone/Safari nicht unnötig lange blockiert wird.
- Engerer, sauberer zentrierter Zahlenbereich.
- PSM 13 bleibt Hauptmodus; PSM 8 wird nur noch als begrenzter Fallback genutzt.
- Der Scanner kann auch nach einem fehlgeschlagenen OCR-Versuch geschlossen werden.


## Version 7.23
- Scanner auf kleinen iPhones explizit vertikal scrollbar gemacht.
- Der Dialog nutzt jetzt 100dvh und iOS-kompatibles Momentum-Scrolling.
- Touch-Gesten im unteren Bereich werden nicht mehr blockiert.
- OCR-Vorschau kompakter.
- Foto-Button wird nach erfolgloser Erkennung sofort wieder aktiviert.
- Aktionsbereich bleibt möglichst am unteren Rand sichtbar.


## Version 7.24
- OCR/Texterkennung für die Patienten-ID vollständig entfernt.
- Tesseract-Bibliothek entfernt.
- Der Nutzer fotografiert nur den Bereich innerhalb des weißen Rahmens.
- Genau dieser kleine Bildausschnitt wird lokal zusammen mit dem Einsatz gespeichert.
- Keine Erkennung oder Interpretation der Ziffern durch die App.
- Kein Upload, keine Cloud-Verarbeitung.
- Der gespeicherte Bildausschnitt wird im Einsatzformular als Vorschau angezeigt und kann wieder entfernt werden.
- Bestehende manuelle Patienten-ID-Felder bleiben aus Gründen der Rückwärtskompatibilität erhalten.


## Version 7.25
- Keine OCR/Texterkennung.
- Nach dem Fotografieren öffnet sich eine manuelle Zuschneideansicht.
- Der Nutzer bestimmt selbst durch Verschieben und Vergrößern/Verkleinern des Rahmens, welche Ziffern zum Patienten-ID-Foto gehören.
- Erst „Übernehmen“ speichert den gewählten Ausschnitt.
- Das vollständige Foto wird danach verworfen.
- Der gespeicherte Ausschnitt wird auf maximal 700 px Breite verkleinert und als JPEG mit reduzierter Qualität gespeichert, um localStorage möglichst wenig zu belasten.
- Gespeicherte ID-Fotos können angetippt und groß angezeigt werden.

## Version 7.26
- Repariert den Foto-Workflow auf iPhone/Safari.
- Foto wird direkt aus dem laufenden Kamerabild aufgenommen.
- Danach öffnet sich die manuelle Zuschneideansicht.
- Der Nutzer bestimmt den Ausschnitt selbst.
- Nur der gewählte Ausschnitt wird mit max. 700 px Breite und JPEG 0,65 lokal gespeichert.
- Vollbildaufnahme wird nach dem Zuschneiden verworfen.
- Veraltete OCR-Hinweise entfernt.

## Version 7.27
Die frühere Scan-/OCR-Funktion wurde vollständig verworfen und neu aufgebaut.

Neue Patienten-ID-Funktion:
1. Kamera öffnen.
2. Foto aufnehmen.
3. Ausschnitt manuell mit verschiebbarem/veränderbarem Rahmen festlegen.
4. Nur diesen Ausschnitt lokal dem jeweiligen Einsatz zuordnen.
5. Ausschnitt später beim Einsatz anzeigen.

Es gibt keine OCR, keine Ziffernerkennung, kein Tesseract, kein PaddleOCR und keinen externen Erkennungsdienst. Das vollständige Foto wird nicht dauerhaft gespeichert. Der gewählte Ausschnitt wird auf maximal 700 Pixel Breite reduziert und als komprimiertes JPEG gespeichert.


## Version 7.28 – Patienten-ID-Foto neu geprüft
- Frühere Scan-/OCR-Logik vollständig aus dem ausführbaren Code entfernt.
- Kamera-Button ist direkt mit der neuen Foto-Funktion verbunden.
- Ablauf: Foto aufnehmen → Ausschnitt selbst festlegen → nur Ausschnitt speichern → dem Einsatz zuordnen.
- Beim Bearbeiten wird der vorhandene Ausschnitt geladen und kann entfernt/ersetzt werden.
- In der Einsatzübersicht kann der Ausschnitt über „Patienten-ID anzeigen“ geöffnet werden.


## Version 7.29
- Manueller Patienten-ID-Ausschnitt auf iPhone nochmals geprüft und robuster gemacht.
- Der weiße Auswahlrahmen lässt sich durch Ziehen innerhalb des Rahmens frei nach oben und unten verschieben, ausdrücklich auch bis an den unteren Rand.
- Größenänderung über alle vier Eckpunkte.
- Pointer-Capture plus Touch-Fallback für Safari/iPhone.
- Während des Verschiebens scrollt nicht versehentlich die Seite.


## Version 7.30
- Zuschneideansicht deutlich kompakter: Das Foto nimmt nicht mehr fast den ganzen Bildschirm ein.
- Auswahlrahmen startet kleiner und eher im Format einer Zahlenzeile.
- Die vier sichtbaren Eckpunkte bleiben klein, haben aber deutlich größere unsichtbare Touch-Flächen.
- Rahmen weiterhin frei verschiebbar; Größenänderung weiterhin über alle vier Ecken.
- Keine OCR oder Ziffernerkennung.


## Version 7.31
- Auswahlrahmen wird jetzt relativ zur tatsächlich sichtbaren Fotofläche berechnet, nicht mehr relativ zur schwarzen Bühne.
- Der Rahmen und alle vier Eckpunkte können die Fotokanten nicht mehr überschreiten.
- Speicherung nutzt exakt dieselben Bildkoordinaten wie der sichtbare Rahmen.
- Kopfzeile der Zuschneideansicht für schmale iPhones korrigiert; „Übernehmen“ bleibt vollständig sichtbar.
- Eingabefelder im Einsatzformular werden strikt auf die verfügbare Sheet-Breite begrenzt und rechts wie links sauber abgerundet.


## Version 7.33
- Rundungslogik für Rufdienste an die anhand realer TimeOffice-Beispiele ermittelte Regel angepasst.
- Telefonisch: Alle Telefonminuten eines Dienstes werden addiert und einmal auf die nächste volle Stunde aufgerundet.
- Im Haus: Jeder einzelne Hauseinsatz wird separat auf die nächste volle Stunde aufgerundet; danach werden die gerundeten Hauseinsatz-Stunden addiert.
- Gesamtstunden und optionale Vergütung verwenden dieselbe neue Rundungslogik.
- Monatsübersicht, Dienst-Detailansicht, CSV und PDF-Bericht wurden entsprechend angepasst.
- Die zuvor vorbereitete, aber nicht veröffentlichte Geräte-Statistik aus Version 7.32 ist nicht enthalten.


## Version 7.34
- Jeder einzelne Einsatz vom Typ „Im Haus“ zeigt in der Detailübersicht zusätzlich direkt seine gerundete Einsatzzeit.
- Beispiel: 70 Min. → 2 Stunden gerundet.
- Telefonische Einträge bleiben unverändert.
- Die Summenkacheln oben bleiben unverändert und verwenden weiterhin die bestehende Gesamtberechnung.


## Version 7.36 – Zwischenstand, nicht produktiv freigegeben
Tarifperiodenbezogene Speicherung des Feiertags-Freizeitausgleichs; keine stillschweigende Verwendung aktueller Zuschlagsgrundlagen für historische Dienste. Fehlende historische Parameter werden als ungeklärt angezeigt. Die vollständige Abrechnungsprüfung ist noch offen.


## Arbeitsstand 7.37
Gehaltsabrechnungsabgleich für Leistungsmonat mit getrenntem Abrechnungsmonat und lokaler Speicherung ergänzt. Noch keine Freigabe: Tarifstaffelung, Zuschlagsgrundlage und Gesamttests offen.
