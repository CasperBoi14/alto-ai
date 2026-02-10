moet:
emails sturen 
Dc messiges sturen
trello kaartjes aanmaken en verplaatsen  
internet zoeken  
afbeeldingen generen 
eigen files systeem  
github informatie lezen
summerize om de 100 functions 
acounds aanmaken (gmail, dc, github en trello)

misschien:
github pushen 
kunnen overleggen

instellingen en vunction:
1. Email sturen 📧
Functies
send_email(to, subject, body, attachments)
read_inbox(filter)
reply_email(thread_id, text)
search_email(query)
Instellingen
SMTP/IMAP credentials
standaard handtekening
max mails per uur
toegestane domeinen
Safety
geen mails naar onbekende domeinen zonder bevestiging
attachment virus-scan
rate limit
2. Discord (DC) messages 💬
Functies
send_dc(channel, message)
reply_dc(message_id, text)
read_dc(channel, limit)
create_thread(name)
Instellingen
bot token
toegestane servers/channels
mention‑filter
Safety
geen @everyone
cooldown tussen berichten
3. Trello kaarten 🧩
Functies
create_card(list, title, desc)
move_card(card_id, list)
add_comment(card_id, text)
read_board(board)
Instellingen
Trello API key
default board
mapping: “urgent → lijst X”
Safety
geen delete zonder confirm
logging van moves
4. Internet zoeken 🌐
Functies
web_search(query)
scrape_page(url)
fact_check(text)
Instellingen
zoekprovider (Google/Bing)
max results
blacklist sites
Safety
geen verdachte downloads
privacy filter
5. Afbeeldingen genereren 🎨
Functies
generate_image(prompt)
edit_image(file, prompt)
resize_image()
Instellingen
model keuze
stijl presets
max resolutie
Safety
geen schadelijke/illegale content
watermark optie
6. Eigen filesysteem 📁
Functies
read_file(path)
write_file(path)
list_folder()
search_files()
Instellingen
root folder sandbox
max size
versiebeheer
Safety
alleen binnen sandbox
backup before overwrite
7. GitHub info lezen 🧑‍💻
Functies
read_repo(repo)
read_issues()
summarize_pr(pr)
search_code()
Instellingen
GitHub token
read‑only scope
favoriete repos
Safety
geen push zonder mens
secrets filter
8. Summarize (100+ functies) 🧠
Functies
summarize_text()
summarize_repo()
daily_summary()
meeting_summary()
Instellingen
max lengte
taal
template
Safety
geen gevoelige data opslaan
9. Accounts aanmaken 🔐
Functies
create_gmail()
create_discord()
create_github()
create_trello()
Instellingen
welke accounts toegestaan
2FA verplicht
recovery mail
Safety (HEEL BELANGRIJK)
nooit automatisch zonder menselijke goedkeuring
wachtwoorden in vault
logging
