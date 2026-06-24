# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: comprehensive.spec.js >> Footer links have purpose >> Shop footer links filter products
- Location: tests/comprehensive.spec.js:144:3

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected substring: "tracksuits"
Received string:    "the drop"
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - img [ref=e6]
      - generic [ref=e8]: Summer drop is live — curated vintage, restocked weekly
    - generic "Sale ends Sunday 23:59" [ref=e9]:
      - text: Sale ends in
      - generic [ref=e10]: 4d 21h 52m
  - banner [ref=e11]:
    - generic [ref=e12]:
      - generic [ref=e13]: REWIND.
      - navigation [ref=e14]:
        - button "New in" [ref=e15] [cursor=pointer]
        - button "Jerseys" [ref=e16] [cursor=pointer]
        - button "Polos" [ref=e17] [cursor=pointer]
        - button "Jumpers" [ref=e18] [cursor=pointer]
        - button "Zip-up Jumpers" [ref=e19] [cursor=pointer]
        - button "Tracksuits" [ref=e20] [cursor=pointer]
        - button "Pants" [ref=e21] [cursor=pointer]
        - button "Sets" [ref=e22] [cursor=pointer]
        - button "Shoes" [ref=e23] [cursor=pointer]
      - generic [ref=e24]:
        - generic [ref=e25]:
          - img [ref=e26]
          - textbox "Search" [ref=e29]
        - button "Wishlist" [ref=e30] [cursor=pointer]:
          - img [ref=e31]
        - button "Cart" [ref=e33] [cursor=pointer]:
          - img [ref=e34]
  - generic [ref=e37]:
    - generic [ref=e38]:
      - generic [ref=e39]:
        - img [ref=e40]
        - text: Summer '26 · Vol. 04
      - heading "Worn once. Loved again." [level=1] [ref=e42]:
        - text: Worn once.
        - text: Loved again.
      - paragraph [ref=e43]: Hand-picked vintage tracksuits, retro jerseys & summer sets. Authenticated, cleaned, and shipped in 24 hours. One of each — when it's gone, it's gone.
      - generic [ref=e44]:
        - button "Shop the drop" [ref=e45] [cursor=pointer]:
          - text: Shop the drop
          - img [ref=e46]
        - button "Browse jerseys" [ref=e48] [cursor=pointer]
      - generic [ref=e49]:
        - generic [ref=e50]:
          - generic [ref=e51]: "4.9"
          - generic [ref=e52]: ★ 2,300+ reviews
        - generic [ref=e53]:
          - generic [ref=e54]: 24h
          - generic [ref=e55]: EU dispatch
        - generic [ref=e56]:
          - generic [ref=e57]: 14d
          - generic [ref=e58]: free returns
    - generic [ref=e63]: DETAIL
  - generic [ref=e65]:
    - generic [ref=e66]:
      - img [ref=e67]
      - text: Authenticated
    - generic [ref=e69]:
      - img [ref=e70]
      - text: Steam-cleaned
    - generic [ref=e72]:
      - img [ref=e73]
      - text: Ships in 24h
    - generic [ref=e75]:
      - img [ref=e76]
      - text: Free EU returns
    - generic [ref=e78]:
      - img [ref=e79]
      - text: One of each
    - generic [ref=e81]:
      - img [ref=e82]
      - text: Restocked weekly
    - generic [ref=e84]:
      - img [ref=e85]
      - text: Authenticated
    - generic [ref=e87]:
      - img [ref=e88]
      - text: Steam-cleaned
    - generic [ref=e90]:
      - img [ref=e91]
      - text: Ships in 24h
    - generic [ref=e93]:
      - img [ref=e94]
      - text: Free EU returns
    - generic [ref=e96]:
      - img [ref=e97]
      - text: One of each
    - generic [ref=e99]:
      - img [ref=e100]
      - text: Restocked weekly
  - main [ref=e102]:
    - generic [ref=e104]:
      - heading "The drop" [level=2] [ref=e105]
      - paragraph [ref=e106]: 16 pieces · one of each
    - generic [ref=e107]:
      - complementary [ref=e108]:
        - heading "Categories" [level=3] [ref=e109]
        - button "All" [ref=e110] [cursor=pointer]
        - button "Jerseys" [ref=e111] [cursor=pointer]
        - button "Polos" [ref=e112] [cursor=pointer]
        - button "Jumpers" [ref=e113] [cursor=pointer]
        - button "Zip-up Jumpers" [ref=e114] [cursor=pointer]
        - button "Tracksuits" [ref=e115] [cursor=pointer]
        - button "Pants" [ref=e116] [cursor=pointer]
        - button "Sets" [ref=e117] [cursor=pointer]
        - button "Shoes" [ref=e118] [cursor=pointer]
      - generic [ref=e120]:
        - generic [ref=e121]:
          - heading "Jerseys" [level=3] [ref=e122]
          - generic [ref=e123]:
            - article [ref=e124]:
              - generic [ref=e125]:
                - generic [ref=e128]: BRASIL '02 JERSEY
                - generic:
                  - generic: "-30%"
                  - generic: Only 3 left
                - button "Quick view" [ref=e129] [cursor=pointer]
                - button "Save to wishlist" [ref=e130] [cursor=pointer]:
                  - img [ref=e131]
              - generic [ref=e133]:
                - generic [ref=e134]:
                  - heading "Brasil '02 Jersey" [level=3] [ref=e135] [cursor=pointer]
                  - generic [ref=e136]: Jerseys
                - generic [ref=e137]:
                  - generic [ref=e138]:
                    - generic [ref=e139]: €42
                    - generic [ref=e140]: €60
                  - button "Add Brasil '02 Jersey" [ref=e141] [cursor=pointer]:
                    - img [ref=e142]
            - article [ref=e144]:
              - generic [ref=e145]:
                - generic [ref=e148]: AZZURRI RETRO JERSEY
                - generic:
                  - generic: "-22%"
                - button "Quick view" [ref=e149] [cursor=pointer]
                - button "Save to wishlist" [ref=e150] [cursor=pointer]:
                  - img [ref=e151]
              - generic [ref=e153]:
                - generic [ref=e154]:
                  - heading "Azzurri Retro Jersey" [level=3] [ref=e155] [cursor=pointer]
                  - generic [ref=e156]: Jerseys
                - generic [ref=e157]:
                  - generic [ref=e158]:
                    - generic [ref=e159]: €45
                    - generic [ref=e160]: €58
                  - button "Add Azzurri Retro Jersey" [ref=e161] [cursor=pointer]:
                    - img [ref=e162]
            - article [ref=e164]:
              - generic [ref=e165]:
                - generic [ref=e168]: MESH TRAINING TOP
                - generic:
                  - generic: "-24%"
                - button "Quick view" [ref=e169] [cursor=pointer]
                - button "Save to wishlist" [ref=e170] [cursor=pointer]:
                  - img [ref=e171]
              - generic [ref=e173]:
                - generic [ref=e174]:
                  - heading "Mesh Training Top" [level=3] [ref=e175] [cursor=pointer]
                  - generic [ref=e176]: Jerseys
                - generic [ref=e177]:
                  - generic [ref=e178]:
                    - generic [ref=e179]: €34
                    - generic [ref=e180]: €45
                  - button "Add Mesh Training Top" [ref=e181] [cursor=pointer]:
                    - img [ref=e182]
        - generic [ref=e184]:
          - heading "Polos" [level=3] [ref=e185]
          - generic [ref=e186]:
            - article [ref=e187]:
              - generic [ref=e188]:
                - generic [ref=e191]: TERRY POLO SET
                - generic:
                  - generic: "-26%"
                  - generic: Only 4 left
                - button "Quick view" [ref=e192] [cursor=pointer]
                - button "Save to wishlist" [ref=e193] [cursor=pointer]:
                  - img [ref=e194]
              - generic [ref=e196]:
                - generic [ref=e197]:
                  - heading "Terry Polo Set" [level=3] [ref=e198] [cursor=pointer]
                  - generic [ref=e199]: Polos
                - generic [ref=e200]:
                  - generic [ref=e201]:
                    - generic [ref=e202]: €52
                    - generic [ref=e203]: €70
                  - button "Add Terry Polo Set" [ref=e204] [cursor=pointer]:
                    - img [ref=e205]
            - article [ref=e207]:
              - generic [ref=e208]:
                - generic [ref=e211]: COTTON PIQUE POLO
                - generic:
                  - generic: "-27%"
                - button "Quick view" [ref=e212] [cursor=pointer]
                - button "Save to wishlist" [ref=e213] [cursor=pointer]:
                  - img [ref=e214]
              - generic [ref=e216]:
                - generic [ref=e217]:
                  - heading "Cotton Pique Polo" [level=3] [ref=e218] [cursor=pointer]
                  - generic [ref=e219]: Polos
                - generic [ref=e220]:
                  - generic [ref=e221]:
                    - generic [ref=e222]: €38
                    - generic [ref=e223]: €52
                  - button "Add Cotton Pique Polo" [ref=e224] [cursor=pointer]:
                    - img [ref=e225]
            - article [ref=e227]:
              - generic [ref=e228]:
                - generic [ref=e231]: STRIPED RUGBY POLO
                - generic:
                  - generic: "-24%"
                  - generic: Only 5 left
                - button "Quick view" [ref=e232] [cursor=pointer]
                - button "Save to wishlist" [ref=e233] [cursor=pointer]:
                  - img [ref=e234]
              - generic [ref=e236]:
                - generic [ref=e237]:
                  - heading "Striped Rugby Polo" [level=3] [ref=e238] [cursor=pointer]
                  - generic [ref=e239]: Polos
                - generic [ref=e240]:
                  - generic [ref=e241]:
                    - generic [ref=e242]: €44
                    - generic [ref=e243]: €58
                  - button "Add Striped Rugby Polo" [ref=e244] [cursor=pointer]:
                    - img [ref=e245]
        - generic [ref=e247]:
          - heading "Jumpers" [level=3] [ref=e248]
          - generic [ref=e249]:
            - article [ref=e250]:
              - generic [ref=e251]:
                - generic [ref=e254]: VINTAGE KNIT JUMPER
                - generic:
                  - generic: "-27%"
                  - generic: Only 4 left
                - button "Quick view" [ref=e255] [cursor=pointer]
                - button "Save to wishlist" [ref=e256] [cursor=pointer]:
                  - img [ref=e257]
              - generic [ref=e259]:
                - generic [ref=e260]:
                  - heading "Vintage Knit Jumper" [level=3] [ref=e261] [cursor=pointer]
                  - generic [ref=e262]: Jumpers
                - generic [ref=e263]:
                  - generic [ref=e264]:
                    - generic [ref=e265]: €55
                    - generic [ref=e266]: €75
                  - button "Add Vintage Knit Jumper" [ref=e267] [cursor=pointer]:
                    - img [ref=e268]
            - article [ref=e270]:
              - generic [ref=e271]:
                - generic [ref=e274]: RETRO CREWNECK
                - generic:
                  - generic: "-23%"
                - button "Quick view" [ref=e275] [cursor=pointer]
                - button "Save to wishlist" [ref=e276] [cursor=pointer]:
                  - img [ref=e277]
              - generic [ref=e279]:
                - generic [ref=e280]:
                  - heading "Retro Crewneck" [level=3] [ref=e281] [cursor=pointer]
                  - generic [ref=e282]: Jumpers
                - generic [ref=e283]:
                  - generic [ref=e284]:
                    - generic [ref=e285]: €48
                    - generic [ref=e286]: €62
                  - button "Add Retro Crewneck" [ref=e287] [cursor=pointer]:
                    - img [ref=e288]
            - article [ref=e290]:
              - generic [ref=e291]:
                - generic [ref=e294]: ARGYLE CARDIGAN
                - generic:
                  - generic: "-26%"
                  - generic: Only 3 left
                - button "Quick view" [ref=e295] [cursor=pointer]
                - button "Save to wishlist" [ref=e296] [cursor=pointer]:
                  - img [ref=e297]
              - generic [ref=e299]:
                - generic [ref=e300]:
                  - heading "Argyle Cardigan" [level=3] [ref=e301] [cursor=pointer]
                  - generic [ref=e302]: Jumpers
                - generic [ref=e303]:
                  - generic [ref=e304]:
                    - generic [ref=e305]: €58
                    - generic [ref=e306]: €78
                  - button "Add Argyle Cardigan" [ref=e307] [cursor=pointer]:
                    - img [ref=e308]
        - generic [ref=e310]:
          - heading "Tracksuits" [level=3] [ref=e311]
          - generic [ref=e312]:
            - article [ref=e313]:
              - generic [ref=e314]:
                - generic [ref=e317]: VELOUR TRACKSUIT '94
                - generic:
                  - generic: "-28%"
                  - generic: Only 4 left
                - button "Quick view" [ref=e318] [cursor=pointer]
                - button "Save to wishlist" [ref=e319] [cursor=pointer]:
                  - img [ref=e320]
              - generic [ref=e322]:
                - generic [ref=e323]:
                  - heading "Velour Tracksuit '94" [level=3] [ref=e324] [cursor=pointer]
                  - generic [ref=e325]: Tracksuits
                - generic [ref=e326]:
                  - generic [ref=e327]:
                    - generic [ref=e328]: €68
                    - generic [ref=e329]: €95
                  - button "Add Velour Tracksuit '94" [ref=e330] [cursor=pointer]:
                    - img [ref=e331]
            - article [ref=e333]:
              - generic [ref=e334]:
                - generic [ref=e337]: SHELL SUIT — COBALT
                - generic:
                  - generic: "-25%"
                - button "Quick view" [ref=e338] [cursor=pointer]
                - button "Save to wishlist" [ref=e339] [cursor=pointer]:
                  - img [ref=e340]
              - generic [ref=e342]:
                - generic [ref=e343]:
                  - heading "Shell Suit — Cobalt" [level=3] [ref=e344] [cursor=pointer]
                  - generic [ref=e345]: Tracksuits
                - generic [ref=e346]:
                  - generic [ref=e347]:
                    - generic [ref=e348]: €54
                    - generic [ref=e349]: €72
                  - button "Add Shell Suit — Cobalt" [ref=e350] [cursor=pointer]:
                    - img [ref=e351]
            - article [ref=e353]:
              - generic [ref=e354]:
                - generic [ref=e357]: WINDBREAKER HALF-ZIP
                - generic:
                  - generic: "-26%"
                - button "Quick view" [ref=e358] [cursor=pointer]
                - button "Save to wishlist" [ref=e359] [cursor=pointer]:
                  - img [ref=e360]
              - generic [ref=e362]:
                - generic [ref=e363]:
                  - heading "Windbreaker Half-Zip" [level=3] [ref=e364] [cursor=pointer]
                  - generic [ref=e365]: Tracksuits
                - generic [ref=e366]:
                  - generic [ref=e367]:
                    - generic [ref=e368]: €58
                    - generic [ref=e369]: €78
                  - button "Add Windbreaker Half-Zip" [ref=e370] [cursor=pointer]:
                    - img [ref=e371]
        - generic [ref=e373]:
          - heading "Shoes" [level=3] [ref=e374]
          - generic [ref=e375]:
            - article [ref=e376]:
              - generic [ref=e377]:
                - generic [ref=e380]: COURT CLASSIC LO
                - generic:
                  - generic: "-27%"
                  - generic: Only 5 left
                - button "Quick view" [ref=e381] [cursor=pointer]
                - button "Save to wishlist" [ref=e382] [cursor=pointer]:
                  - img [ref=e383]
              - generic [ref=e385]:
                - generic [ref=e386]:
                  - heading "Court Classic Lo" [level=3] [ref=e387] [cursor=pointer]
                  - generic [ref=e388]: Shoes
                - generic [ref=e389]:
                  - generic [ref=e390]:
                    - generic [ref=e391]: €72
                    - generic [ref=e392]: €99
                  - button "Add Court Classic Lo" [ref=e393] [cursor=pointer]:
                    - img [ref=e394]
            - article [ref=e396]:
              - generic [ref=e397]:
                - generic [ref=e400]: SUEDE RUNNER '88
                - generic:
                  - generic: "-23%"
                - button "Quick view" [ref=e401] [cursor=pointer]
                - button "Save to wishlist" [ref=e402] [cursor=pointer]:
                  - img [ref=e403]
              - generic [ref=e405]:
                - generic [ref=e406]:
                  - heading "Suede Runner '88" [level=3] [ref=e407] [cursor=pointer]
                  - generic [ref=e408]: Shoes
                - generic [ref=e409]:
                  - generic [ref=e410]:
                    - generic [ref=e411]: €85
                    - generic [ref=e412]: €110
                  - button "Add Suede Runner '88" [ref=e413] [cursor=pointer]:
                    - img [ref=e414]
            - article [ref=e416]:
              - generic [ref=e417]:
                - generic [ref=e420]: HI-TOP RETRO
                - generic:
                  - generic: "-26%"
                - button "Quick view" [ref=e421] [cursor=pointer]
                - button "Save to wishlist" [ref=e422] [cursor=pointer]:
                  - img [ref=e423]
              - generic [ref=e425]:
                - generic [ref=e426]:
                  - heading "Hi-Top Retro" [level=3] [ref=e427] [cursor=pointer]
                  - generic [ref=e428]: Shoes
                - generic [ref=e429]:
                  - generic [ref=e430]:
                    - generic [ref=e431]: €78
                    - generic [ref=e432]: €105
                  - button "Add Hi-Top Retro" [ref=e433] [cursor=pointer]:
                    - img [ref=e434]
        - generic [ref=e436]:
          - heading "Ralph Lauren — Polos" [level=3] [ref=e437]
          - article [ref=e439]:
            - generic [ref=e440]:
              - generic [ref=e443]: RALPH LAUREN - POLO - TOKYO
              - generic:
                - generic: "-40%"
                - generic: Only 5 left
              - button "Quick view" [ref=e444] [cursor=pointer]
              - button "Save to wishlist" [ref=e445] [cursor=pointer]:
                - img [ref=e446]
            - generic [ref=e448]:
              - generic [ref=e449]:
                - heading "Ralph Lauren - Polo - Tokyo" [level=3] [ref=e450] [cursor=pointer]
                - generic [ref=e451]: Polos
              - generic [ref=e452]:
                - generic [ref=e453]:
                  - generic [ref=e454]: €45
                  - generic [ref=e455]: €74.99
                - button "Add Ralph Lauren - Polo - Tokyo" [ref=e456] [cursor=pointer]:
                  - img [ref=e457]
  - contentinfo [ref=e459]:
    - generic [ref=e460]:
      - generic [ref=e461]: REWIND.
      - paragraph [ref=e462]: Curated vintage & retro sportswear. Each piece is one of one — sourced, authenticated, and sent on within a day.
    - generic [ref=e463]:
      - generic [ref=e464]:
        - heading "Shop" [level=4] [ref=e465]
        - generic [ref=e466] [cursor=pointer]: New in
        - generic [ref=e467] [cursor=pointer]: Tracksuits
        - generic [ref=e468] [cursor=pointer]: Jerseys
        - generic [ref=e469] [cursor=pointer]: Sets
        - generic [ref=e470] [cursor=pointer]: Kicks
      - generic [ref=e471]:
        - heading "Help" [level=4] [ref=e472]
        - generic [ref=e473] [cursor=pointer]: Sizing
        - generic [ref=e474] [cursor=pointer]: Shipping
        - generic [ref=e475] [cursor=pointer]: Returns
        - generic [ref=e476] [cursor=pointer]: Track order
      - generic [ref=e477]:
        - heading "Pay with" [level=4] [ref=e478]
        - generic [ref=e479] [cursor=pointer]: PayPal
        - generic [ref=e480] [cursor=pointer]: Payconiq
        - generic [ref=e481] [cursor=pointer]: Apple Pay
        - generic [ref=e482] [cursor=pointer]: Bancontact
        - generic [ref=e483] [cursor=pointer]: Klarna
    - generic [ref=e484]: © 2026 REWIND. A prototype. Prices & stock illustrative.
  - generic [ref=e485]:
    - generic [ref=e486]:
      - heading "Bag" [level=3] [ref=e487]
      - button "Close" [ref=e488] [cursor=pointer]:
        - img [ref=e489]
    - generic [ref=e491]:
      - img [ref=e492]
      - text: Add €150 more for free shipping
    - generic [ref=e497]:
      - img [ref=e498]
      - paragraph [ref=e501]: Your bag is empty
  - generic [ref=e502]:
    - generic [ref=e503]:
      - heading "Wishlist (0)" [level=3] [ref=e504]:
        - text: Wishlist
        - generic [ref=e505]: (0)
      - button "Close" [ref=e506] [cursor=pointer]:
        - img [ref=e507]
    - generic [ref=e509]:
      - img [ref=e510]
      - paragraph [ref=e512]: Your wishlist is empty
```

# Test source

```ts
  66  |   test('admin panel loads', async ({ page }) => {
  67  |     await page.goto(`${BASE}/#admin`, { waitUntil: 'networkidle' });
  68  |     await expect(page.locator('h1')).toContainText(/REWIND Admin/i);
  69  |   });
  70  | });
  71  | 
  72  | // ── Navigation buttons ─────────────────────────────────────────
  73  | test.describe('Navigation buttons work', () => {
  74  |   test.beforeEach(async ({ page }) => {
  75  |     await page.goto(BASE, { waitUntil: 'networkidle' });
  76  |   });
  77  | 
  78  |   test('header nav buttons switch categories', async ({ page }) => {
  79  |     const buttons = await nav(page);
  80  |     const count = await buttons.count();
  81  |     expect(count).toBeGreaterThan(5); // Should have All + at least 5 categories
  82  | 
  83  |     // Click each and verify the section title updates
  84  |     for (let i = 1; i < Math.min(count, 6); i++) {
  85  |       const label = await buttons.nth(i).textContent();
  86  |       await buttons.nth(i).click();
  87  |       await page.waitForTimeout(300);
  88  |       // Title should reflect the category
  89  |       const title = page.locator('.rw-shop-title');
  90  |       await expect(title).toBeVisible();
  91  |       const titleText = await title.textContent();
  92  |       expect(titleText?.toLowerCase()).toContain(label?.trim().toLowerCase() || '');
  93  |     }
  94  |   });
  95  | 
  96  |   test('sidebar category buttons filter products', async ({ page }) => {
  97  |     // Scroll to shop
  98  |     await page.evaluate(() => document.getElementById('the-drop')?.scrollIntoView());
  99  |     await page.waitForTimeout(300);
  100 | 
  101 |     const sidebar = await sidebarCats(page);
  102 |     const count = await sidebar.count();
  103 |     expect(count).toBeGreaterThan(3);
  104 | 
  105 |     for (let i = 1; i < Math.min(count, 5); i++) {
  106 |       const label = await sidebar.nth(i).textContent();
  107 |       await sidebar.nth(i).click();
  108 |       await page.waitForTimeout(300);
  109 |       const title = page.locator('.rw-shop-title');
  110 |       await expect(title).toBeVisible();
  111 |       const titleText = await title.textContent();
  112 |       expect(titleText?.toLowerCase()).toContain(label?.trim().toLowerCase() || '');
  113 |     }
  114 |   });
  115 | 
  116 |   test('hero buttons scroll to shop', async ({ page }) => {
  117 |     const btns = await heroBtn(page);
  118 |     expect(await btns.count()).toBe(2);
  119 | 
  120 |     // Click "Shop the drop"
  121 |     await btns.first().click();
  122 |     await page.waitForTimeout(500);
  123 |     const shop = page.locator('#the-drop');
  124 |     await expect(shop).toBeVisible();
  125 | 
  126 |     // Click "Browse jerseys"
  127 |     await page.goto(BASE, { waitUntil: 'networkidle' });
  128 |     await btns.last().click();
  129 |     await page.waitForTimeout(500);
  130 |     // Should scroll to shop and likely filter to Jerseys
  131 |     await expect(page.locator('#the-drop')).toBeVisible();
  132 |   });
  133 | });
  134 | 
  135 | // ── Footer links ───────────────────────────────────────────────
  136 | test.describe('Footer links have purpose', () => {
  137 |   test.beforeEach(async ({ page }) => {
  138 |     await page.goto(BASE, { waitUntil: 'networkidle' });
  139 |     // Scroll to footer
  140 |     await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  141 |     await page.waitForTimeout(300);
  142 |   });
  143 | 
  144 |   test('Shop footer links filter products', async ({ page }) => {
  145 |     // Get initial footer links count to validate
  146 |     let links = await footerShopLinks(page);
  147 |     let count = await links.count();
  148 |     expect(count).toBeGreaterThanOrEqual(4); // 5 if 'New in' still deployed, 4 if removed
  149 | 
  150 |     // Click each shop link and verify it filters
  151 |     for (let attempt = 0; attempt < count; attempt++) {
  152 |       // Re-locate after every click (page re-renders)
  153 |       links = await footerShopLinks(page);
  154 |       const n = await links.count();
  155 |       if (attempt >= n) break;
  156 |       const label = await links.nth(attempt).textContent();
  157 |       if (label?.trim() === 'New in') continue; // skip, it's the "All" category
  158 |       await links.nth(attempt).click({ force: true });
  159 |       await page.waitForTimeout(400);
  160 |       // Should scroll up and show filtered title
  161 |       const title = page.locator('.rw-shop-title');
  162 |       await expect(title).toBeVisible();
  163 |       const titleText = await title.textContent();
  164 |       // Kicks maps to Shoes in the system
  165 |       const expected = label?.trim() === 'Kicks' ? 'Shoes' : label?.trim();
> 166 |       expect(titleText?.toLowerCase()).toContain(expected?.toLowerCase() || '');
      |                                        ^ Error: expect(received).toContain(expected) // indexOf
  167 | 
  168 |       // Re-locate footer links after page scroll, then scroll back down
  169 |       await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  170 |       await page.waitForTimeout(300);
  171 |     }
  172 |   });
  173 | 
  174 |   test('Help footer links open modals', async ({ page }) => {
  175 |     const helpSection = page.locator('.rw-footer-cols div:nth-child(2) a');
  176 |     const count = await helpSection.count();
  177 |     expect(count).toBeGreaterThanOrEqual(4); // Sizing, Shipping, Returns, Track order
  178 | 
  179 |     // Click Sizing — opens SizeGuide modal
  180 |     await helpSection.first().click({ force: true });
  181 |     await page.waitForTimeout(400);
  182 |     await expect(page.locator('.rw-modal')).toBeVisible({ timeout: 3000 });
  183 |     // Close it
  184 |     await page.locator('.rw-modal button, .rw-modal-x').first().click({ force: true });
  185 |     await page.waitForTimeout(500);
  186 |     await expect(page.locator('.rw-modal')).not.toBeVisible({ timeout: 2000 });
  187 | 
  188 |     // Click Shipping — opens InfoModal
  189 |     await helpSection.nth(1).click({ force: true });
  190 |     await page.waitForTimeout(400);
  191 |     const modal = page.locator('.rw-modal');
  192 |     await expect(modal).toBeVisible({ timeout: 3000 });
  193 |     // Close InfoModal (it has a Close or Back button)
  194 |     await modal.locator('button').first().click({ force: true });
  195 |     await page.waitForTimeout(500);
  196 |   });
  197 | });
  198 | 
  199 | // ── Product cards ──────────────────────────────────────────────
  200 | test.describe('Product card interactions', () => {
  201 |   test.beforeEach(async ({ page }) => {
  202 |     await page.goto(BASE, { waitUntil: 'networkidle' });
  203 |   });
  204 | 
  205 |   test('quick view opens modal with product info', async ({ page }) => {
  206 |     const cardButtons = await cards(page);
  207 |     const count = await cardButtons.count();
  208 |     if (count === 0) return; // No products loaded
  209 | 
  210 |     // Hover first card to reveal quick view button, then click
  211 |     const firstCard = cardButtons.first();
  212 |     await firstCard.hover();
  213 |     const quickBtn = firstCard.locator('.rw-card-quick');
  214 |     await expect(quickBtn).toBeVisible({ timeout: 3000 });
  215 |     await quickBtn.click();
  216 |     await page.waitForTimeout(400);
  217 | 
  218 |     const modal = await quickView(page);
  219 |     await expect(modal).toBeVisible();
  220 |     // Should have product info
  221 |     await expect(modal.locator('h2')).toBeVisible();
  222 |     // Should have Add to bag button
  223 |     await expect(modal.locator('button:has-text("Add to bag")')).toBeVisible();
  224 |     // Should have Free returns
  225 |     await expect(modal.locator('text=Free returns')).toBeVisible();
  226 |     // Should have size selector
  227 |     await expect(modal.locator('.rw-sizes')).toBeVisible();
  228 |     // Close modal
  229 |     await modal.locator('.rw-modal-x').click();
  230 |     await expect(modal).not.toBeVisible({ timeout: 2000 });
  231 |   });
  232 | 
  233 |   test('wishlist heart toggles', async ({ page }) => {
  234 |     const cardButtons = await cards(page);
  235 |     const count = await cardButtons.count();
  236 |     if (count === 0) return;
  237 | 
  238 |     const firstCard = cardButtons.first();
  239 |     await firstCard.hover();
  240 |     const favBtn = firstCard.locator('.rw-card-fav');
  241 |     await expect(favBtn).toBeVisible({ timeout: 3000 });
  242 | 
  243 |     // Click to wishlist
  244 |     await favBtn.click();
  245 |     await page.waitForTimeout(300);
  246 |     // Should show toast or signup modal
  247 |     const signup = page.locator('.rw-modal--signup');
  248 |     if (await signup.isVisible({ timeout: 1000 }).catch(() => false)) {
  249 |       // User isn't signed in — close signup modal
  250 |       await signup.locator('.rw-modal-x').click();
  251 |     } else {
  252 |       // If signed in, heart should toggle
  253 |       const t = await toast(page);
  254 |       expect(await t.isVisible()).toBeTruthy();
  255 |     }
  256 |   });
  257 | 
  258 |   test('free returns + shipping strikethrough on each card', async ({ page }) => {
  259 |     await page.goto(BASE, { waitUntil: 'networkidle' });
  260 | 
  261 |     // Scroll to the shop grid so all cards load
  262 |     await page.evaluate(() => document.getElementById('the-drop')?.scrollIntoView());
  263 |     await page.waitForTimeout(500);
  264 | 
  265 |     const cardButtons = await cards(page);
  266 |     const count = await cardButtons.count();
```