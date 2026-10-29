# Script EN v1 — "Dead Code Woke Up and Burned $460M in 45 Minutes"

Same beats, timing and screen plan as `ru.md` (approved 27.10.2026). Not a translation: idioms and memes adapted for an English-speaking audience. ~150 wpm → ≈ 7:00. "By our math" = our calculation, labelled on screen.

---

## 1. Hook · 0:00–0:30

On August first, 2012, at exactly nine-thirty in the morning, the New York market opened, and a company that handled roughly one out of every ten stock trades in America started buying and selling shares as if somebody had cut its brakes: more than four million trades in forty-five minutes, which, by our math, works out to about fifteen hundred a second. By the time anyone stopped it, the company had lost four hundred and sixty million dollars, and the culprit wasn't a hacker, or even a fresh bug in new code. It was code nobody had run in nine years, code everyone assumed was dead.

- **Screen / meme / source:** as RU beat 1. Seed notification "08:01 · BNET REJECT · Power Peg disabled". SEC ¶1, ¶11, ¶17.

## 2. Who Knight was · 0:30–1:30

Knight Capital wasn't a bank. It was a market maker: a middleman that brokers sent ordinary people's orders to, every time someone tapped "buy" in a trading app, and Knight would instantly find the other side of that trade and pocket a tiny spread. The work was done not by people but by a system called SMARS, a router that decided where each order went, and in what pieces. That summer, the New York Stock Exchange was launching a new program for retail orders, set to go live on August first, so Knight did what every tech company does on a deadline: it wrote new code and began rolling it out on July twenty-seventh. There were eight of them.

- **Screen / source:** as RU beat 2. SEC ¶11, ¶12, ¶15.

## 3. The dead code · 1:30–2:45

To understand what went wrong, meet the real main character of this story. It isn't a person; it's a feature called Power Peg. It once did something sensible: it took a big client order, the parent, and sent it to the market as a series of small child orders, while a counter kept track of how much had been filled, and the moment the parent was complete, the counter said: stop. In 2003, Knight stopped using Power Peg, but never deleted the code; it just switched it off. Then, in 2005, that counter was moved to a different part of the program, and nobody re-tested Power Peg, because why would you test something that never runs? So inside a live system that touched a tenth of the American stock market, a piece of code with no brakes slept for nine years. And if you've ever written software, you know why nobody deleted it: deleting things is scary, and this thing was quiet.

- **Meme:** emotion "of course" → Hide the Pain Harold, captioned "if it ain't broke…", right after "deleting things is scary".
- **Screen / source:** as RU beat 3. SEC ¶13, ¶14.

## 4. The flag and the eighth server · 2:45–3:45

Now back to the new code. To switch the new feature on, Knight's developers used a flag, a little toggle carried inside each order, and they recycled the flag that used to switch on Power Peg, since nobody needed the old one anymore. Picture relabeling an old switch in a new apartment "lights", not knowing that in one of eight rooms it's still wired to something the last tenant left behind. The new code went onto seven servers, and on those seven the flag meant the new feature. On the eighth, as the Securities and Exchange Commission later found, a technician simply didn't copy the new code, and nobody caught it: there was no second review, and no written rule requiring one. So the eighth server was still running the old code, and to the old code, that very same flag meant something else entirely: wake up Power Peg.

- **Meme:** emotion "same thing, two meanings" → Spider-Man pointing at Spider-Man.
- **Screen / source:** as RU beat 4. SEC ¶13, ¶15, ¶16.

## 5. Forty-five minutes · 3:45–5:00

At nine-thirty the market opened, flagged orders flowed to all eight servers, seven handled them correctly, and on the eighth, Power Peg woke up. It did exactly what it was built to do: it split every parent order into child orders and fired them at the market, except the counter that was supposed to say "stop" wasn't there anymore, so it never stopped. It was a bucket with no bottom and a hose that wouldn't turn off. The exchange noticed almost immediately: by the third minute, volume was more than double the norm, and according to the head of the NYSE, they called Knight within minutes of the opening bell. But Knight had no kill switch: there was no procedure for halting the system if it started behaving abnormally, and monitoring depended entirely on people staring at screens. While staff hunted for the cause, unwanted positions piled up, until Knight held three and a half billion dollars of stock in eighty companies and was short another three billion, and by our math every minute was costing it around ten million dollars.

- **Meme:** emotion "everything's on fire and we're calm" → This is fine (KC Green original, still image), on "people staring at screens".
- **Screen / source:** as RU beat 5. SEC ¶16, ¶17, ¶21, ¶25; NYT.

## 6. The rollback · 5:00–6:00

This is the part every engineer watches through their fingers. When a release goes up in flames, any team rolls it back, and that's what Knight did: it removed the new code from the seven servers where it had been installed correctly. Except the flag was still riding along in every order, and underneath the new code on those servers sat the same old code, with Power Peg inside. The Commission's report puts it with chilling calm: the rollback worsened the problem, and incoming orders began triggering Power Peg on those servers, just as had already happened on the eighth. One broken server became eight. They fought the fire with gasoline, and they did it with the best of intentions. The algorithm was finally shut off at ten-fifteen.

- **Meme:** emotion "the plan that backfired" → Gru's Plan (ship it → it's on fire → roll back → it got worse).
- **Screen / source:** as RU beat 6. SEC ¶27; Fortune.

## 7. Aftermath · 6:00–6:45

Knight itself put the loss at four hundred and forty million and called it "possibly fatal"; the Commission later counted four hundred and sixty. Over three days the stock lost about sixty percent of its value, Goldman Sachs bought up the unwanted positions at a discount, and within days a group of investors put four hundred million dollars into Knight and walked away owning most of it. In December, Knight agreed to merge with a rival, and in 2013 the Commission fined it twelve million dollars and listed everything the firm had been missing: written deployment procedures, a second review, an incident response plan, and a way to stop its own system. Notice there's no technician's name on that list. There's no villain here, just a system where one mistake could reach the market without hitting a single wall.

- **Meme:** none — serious tone, no jokes at people's expense.
- **Screen / source:** as RU beat 7. NYT, CNN, Hartford Business, SEC ¶15, ¶25, ¶27, §IV.C.

## 8. Payoff · 6:45–7:15

One last thing. Remember that notification at the very start? At 8:01 that morning, an hour and a half before the market opened, Knight's system emailed its staff an error that literally said "Power Peg disabled", and before the opening bell it sent ninety-seven of them. The system named the dead code, over and over, but as the Commission notes, staff generally didn't review those emails, because automated alerts pile up and almost all of them mean nothing. Code you don't delete doesn't go anywhere: it just waits for someone to flip its switch again, and after nine years, there was nobody left at Knight who remembered what that switch was wired to.

Next time: why the Nigerian prince writes such terrible emails, and why that's not a mistake.

- **Meme:** emotion "of course" → Surprised Pikachu, short, right after "ninety-seven of them" (aimed at the situation, not at people).
- **Screen / source:** as RU beat 8. SEC ¶19.

---

**Adaptation notes vs RU:** beat 3 meme — Hide the Pain Harold + "if it ain't broke…" instead of the RU text meme «Работает — не трогай»; "watches through their fingers", "fought the fire with gasoline", "cut its brakes" chosen as native idioms, not calques; numbers read the way English VO reads them ("four hundred and sixty million"). Facts, order and beats identical.
