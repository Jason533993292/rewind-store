# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: comprehensive.spec.js >> Cart lifecycle >> full checkout flow places order
- Location: tests/comprehensive.spec.js:367:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.rw-confirm, h2:has-text("Order confirmed")')
Expected: visible
Error: strict mode violation: locator('.rw-confirm, h2:has-text("Order confirmed")') resolved to 2 elements:
    1) <div class="rw-confirm">…</div> aka getByText('Order confirmedThanks for')
    2) <h2>Order confirmed</h2> aka getByRole('heading', { name: 'Order confirmed' })

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('.rw-confirm, h2:has-text("Order confirmed")')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - img [ref=e6]
      - generic [ref=e8]: Free returns within 14 days · Ships from EU in 24h
    - generic "Sale ends Sunday 23:59" [ref=e9]:
      - text: Sale ends in
      - generic [ref=e10]: 4d 21h 48m
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
          - generic [ref=e37]: "1"
  - generic [ref=e38]:
    - generic [ref=e39]:
      - generic [ref=e40]:
        - img [ref=e41]
        - text: Summer '26 · Vol. 04
      - heading "Worn once. Loved again." [level=1] [ref=e43]:
        - text: Worn once.
        - text: Loved again.
      - paragraph [ref=e44]: Hand-picked vintage tracksuits, retro jerseys & summer sets. Authenticated, cleaned, and shipped in 24 hours. One of each — when it's gone, it's gone.
      - generic [ref=e45]:
        - button "Shop the drop" [ref=e46] [cursor=pointer]:
          - text: Shop the drop
          - img [ref=e47]
        - button "Browse jerseys" [ref=e49] [cursor=pointer]
      - generic [ref=e50]:
        - generic [ref=e51]:
          - generic [ref=e52]: "4.9"
          - generic [ref=e53]: ★ 2,300+ reviews
        - generic [ref=e54]:
          - generic [ref=e55]: 24h
          - generic [ref=e56]: EU dispatch
        - generic [ref=e57]:
          - generic [ref=e58]: 14d
          - generic [ref=e59]: free returns
    - generic [ref=e64]: DETAIL
  - generic [ref=e66]:
    - generic [ref=e67]:
      - img [ref=e68]
      - text: Authenticated
    - generic [ref=e70]:
      - img [ref=e71]
      - text: Steam-cleaned
    - generic [ref=e73]:
      - img [ref=e74]
      - text: Ships in 24h
    - generic [ref=e76]:
      - img [ref=e77]
      - text: Free EU returns
    - generic [ref=e79]:
      - img [ref=e80]
      - text: One of each
    - generic [ref=e82]:
      - img [ref=e83]
      - text: Restocked weekly
    - generic [ref=e85]:
      - img [ref=e86]
      - text: Authenticated
    - generic [ref=e88]:
      - img [ref=e89]
      - text: Steam-cleaned
    - generic [ref=e91]:
      - img [ref=e92]
      - text: Ships in 24h
    - generic [ref=e94]:
      - img [ref=e95]
      - text: Free EU returns
    - generic [ref=e97]:
      - img [ref=e98]
      - text: One of each
    - generic [ref=e100]:
      - img [ref=e101]
      - text: Restocked weekly
  - main [ref=e103]:
    - generic [ref=e105]:
      - heading "The drop" [level=2] [ref=e106]
      - paragraph [ref=e107]: 16 pieces · one of each
    - generic [ref=e108]:
      - complementary [ref=e109]:
        - heading "Categories" [level=3] [ref=e110]
        - button "All" [ref=e111] [cursor=pointer]
        - button "Jerseys" [ref=e112] [cursor=pointer]
        - button "Polos" [ref=e113] [cursor=pointer]
        - button "Jumpers" [ref=e114] [cursor=pointer]
        - button "Zip-up Jumpers" [ref=e115] [cursor=pointer]
        - button "Tracksuits" [ref=e116] [cursor=pointer]
        - button "Pants" [ref=e117] [cursor=pointer]
        - button "Sets" [ref=e118] [cursor=pointer]
        - button "Shoes" [ref=e119] [cursor=pointer]
      - generic [ref=e121]:
        - generic [ref=e122]:
          - heading "Jerseys" [level=3] [ref=e123]
          - generic [ref=e124]:
            - article [ref=e125]:
              - generic [ref=e126]:
                - generic [ref=e129]: BRASIL '02 JERSEY
                - generic:
                  - generic: "-30%"
                  - generic: Only 3 left
                - button "Quick view" [ref=e130] [cursor=pointer]
                - button "Save to wishlist" [ref=e131] [cursor=pointer]:
                  - img [ref=e132]
              - generic [ref=e134]:
                - generic [ref=e135]:
                  - heading "Brasil '02 Jersey" [level=3] [ref=e136] [cursor=pointer]
                  - generic [ref=e137]: Jerseys
                - generic [ref=e138]:
                  - generic [ref=e139]:
                    - generic [ref=e140]: €42
                    - generic [ref=e141]: €60
                  - button "Add Brasil '02 Jersey" [ref=e142] [cursor=pointer]:
                    - img [ref=e143]
                - generic [ref=e145]:
                  - img [ref=e146]
                  - text: Free returns
                  - generic [ref=e149]: €8
            - article [ref=e150]:
              - generic [ref=e151]:
                - generic [ref=e154]: AZZURRI RETRO JERSEY
                - generic:
                  - generic: "-22%"
                - button "Quick view" [ref=e155] [cursor=pointer]
                - button "Save to wishlist" [ref=e156] [cursor=pointer]:
                  - img [ref=e157]
              - generic [ref=e159]:
                - generic [ref=e160]:
                  - heading "Azzurri Retro Jersey" [level=3] [ref=e161] [cursor=pointer]
                  - generic [ref=e162]: Jerseys
                - generic [ref=e163]:
                  - generic [ref=e164]:
                    - generic [ref=e165]: €45
                    - generic [ref=e166]: €58
                  - button "Add Azzurri Retro Jersey" [ref=e167] [cursor=pointer]:
                    - img [ref=e168]
                - generic [ref=e170]:
                  - img [ref=e171]
                  - text: Free returns
                  - generic [ref=e174]: €8
            - article [ref=e175]:
              - generic [ref=e176]:
                - generic [ref=e179]: MESH TRAINING TOP
                - generic:
                  - generic: "-24%"
                - button "Quick view" [ref=e180] [cursor=pointer]
                - button "Save to wishlist" [ref=e181] [cursor=pointer]:
                  - img [ref=e182]
              - generic [ref=e184]:
                - generic [ref=e185]:
                  - heading "Mesh Training Top" [level=3] [ref=e186] [cursor=pointer]
                  - generic [ref=e187]: Jerseys
                - generic [ref=e188]:
                  - generic [ref=e189]:
                    - generic [ref=e190]: €34
                    - generic [ref=e191]: €45
                  - button "Add Mesh Training Top" [ref=e192] [cursor=pointer]:
                    - img [ref=e193]
                - generic [ref=e195]:
                  - img [ref=e196]
                  - text: Free returns
                  - generic [ref=e199]: €8
        - generic [ref=e200]:
          - heading "Polos" [level=3] [ref=e201]
          - generic [ref=e202]:
            - article [ref=e203]:
              - generic [ref=e204]:
                - generic [ref=e207]: TERRY POLO SET
                - generic:
                  - generic: "-26%"
                  - generic: Only 4 left
                - button "Quick view" [ref=e208] [cursor=pointer]
                - button "Save to wishlist" [ref=e209] [cursor=pointer]:
                  - img [ref=e210]
              - generic [ref=e212]:
                - generic [ref=e213]:
                  - heading "Terry Polo Set" [level=3] [ref=e214] [cursor=pointer]
                  - generic [ref=e215]: Polos
                - generic [ref=e216]:
                  - generic [ref=e217]:
                    - generic [ref=e218]: €52
                    - generic [ref=e219]: €70
                  - button "Add Terry Polo Set" [ref=e220] [cursor=pointer]:
                    - img [ref=e221]
                - generic [ref=e223]:
                  - img [ref=e224]
                  - text: Free returns
                  - generic [ref=e227]: €8
            - article [ref=e228]:
              - generic [ref=e229]:
                - generic [ref=e232]: COTTON PIQUE POLO
                - generic:
                  - generic: "-27%"
                - button "Quick view" [ref=e233] [cursor=pointer]
                - button "Save to wishlist" [ref=e234] [cursor=pointer]:
                  - img [ref=e235]
              - generic [ref=e237]:
                - generic [ref=e238]:
                  - heading "Cotton Pique Polo" [level=3] [ref=e239] [cursor=pointer]
                  - generic [ref=e240]: Polos
                - generic [ref=e241]:
                  - generic [ref=e242]:
                    - generic [ref=e243]: €38
                    - generic [ref=e244]: €52
                  - button "Add Cotton Pique Polo" [ref=e245] [cursor=pointer]:
                    - img [ref=e246]
                - generic [ref=e248]:
                  - img [ref=e249]
                  - text: Free returns
                  - generic [ref=e252]: €8
            - article [ref=e253]:
              - generic [ref=e254]:
                - generic [ref=e257]: STRIPED RUGBY POLO
                - generic:
                  - generic: "-24%"
                  - generic: Only 5 left
                - button "Quick view" [ref=e258] [cursor=pointer]
                - button "Save to wishlist" [ref=e259] [cursor=pointer]:
                  - img [ref=e260]
              - generic [ref=e262]:
                - generic [ref=e263]:
                  - heading "Striped Rugby Polo" [level=3] [ref=e264] [cursor=pointer]
                  - generic [ref=e265]: Polos
                - generic [ref=e266]:
                  - generic [ref=e267]:
                    - generic [ref=e268]: €44
                    - generic [ref=e269]: €58
                  - button "Add Striped Rugby Polo" [ref=e270] [cursor=pointer]:
                    - img [ref=e271]
                - generic [ref=e273]:
                  - img [ref=e274]
                  - text: Free returns
                  - generic [ref=e277]: €8
        - generic [ref=e278]:
          - heading "Jumpers" [level=3] [ref=e279]
          - generic [ref=e280]:
            - article [ref=e281]:
              - generic [ref=e282]:
                - generic [ref=e285]: VINTAGE KNIT JUMPER
                - generic:
                  - generic: "-27%"
                  - generic: Only 4 left
                - button "Quick view" [ref=e286] [cursor=pointer]
                - button "Save to wishlist" [ref=e287] [cursor=pointer]:
                  - img [ref=e288]
              - generic [ref=e290]:
                - generic [ref=e291]:
                  - heading "Vintage Knit Jumper" [level=3] [ref=e292] [cursor=pointer]
                  - generic [ref=e293]: Jumpers
                - generic [ref=e294]:
                  - generic [ref=e295]:
                    - generic [ref=e296]: €55
                    - generic [ref=e297]: €75
                  - button "Add Vintage Knit Jumper" [ref=e298] [cursor=pointer]:
                    - img [ref=e299]
                - generic [ref=e301]:
                  - img [ref=e302]
                  - text: Free returns
                  - generic [ref=e305]: €8
            - article [ref=e306]:
              - generic [ref=e307]:
                - generic [ref=e310]: RETRO CREWNECK
                - generic:
                  - generic: "-23%"
                - button "Quick view" [ref=e311] [cursor=pointer]
                - button "Save to wishlist" [ref=e312] [cursor=pointer]:
                  - img [ref=e313]
              - generic [ref=e315]:
                - generic [ref=e316]:
                  - heading "Retro Crewneck" [level=3] [ref=e317] [cursor=pointer]
                  - generic [ref=e318]: Jumpers
                - generic [ref=e319]:
                  - generic [ref=e320]:
                    - generic [ref=e321]: €48
                    - generic [ref=e322]: €62
                  - button "Add Retro Crewneck" [ref=e323] [cursor=pointer]:
                    - img [ref=e324]
                - generic [ref=e326]:
                  - img [ref=e327]
                  - text: Free returns
                  - generic [ref=e330]: €8
            - article [ref=e331]:
              - generic [ref=e332]:
                - generic [ref=e335]: ARGYLE CARDIGAN
                - generic:
                  - generic: "-26%"
                  - generic: Only 3 left
                - button "Quick view" [ref=e336] [cursor=pointer]
                - button "Save to wishlist" [ref=e337] [cursor=pointer]:
                  - img [ref=e338]
              - generic [ref=e340]:
                - generic [ref=e341]:
                  - heading "Argyle Cardigan" [level=3] [ref=e342] [cursor=pointer]
                  - generic [ref=e343]: Jumpers
                - generic [ref=e344]:
                  - generic [ref=e345]:
                    - generic [ref=e346]: €58
                    - generic [ref=e347]: €78
                  - button "Add Argyle Cardigan" [ref=e348] [cursor=pointer]:
                    - img [ref=e349]
                - generic [ref=e351]:
                  - img [ref=e352]
                  - text: Free returns
                  - generic [ref=e355]: €8
        - generic [ref=e356]:
          - heading "Tracksuits" [level=3] [ref=e357]
          - generic [ref=e358]:
            - article [ref=e359]:
              - generic [ref=e360]:
                - generic [ref=e363]: VELOUR TRACKSUIT '94
                - generic:
                  - generic: "-28%"
                  - generic: Only 4 left
                - button "Quick view" [ref=e364] [cursor=pointer]
                - button "Save to wishlist" [ref=e365] [cursor=pointer]:
                  - img [ref=e366]
              - generic [ref=e368]:
                - generic [ref=e369]:
                  - heading "Velour Tracksuit '94" [level=3] [ref=e370] [cursor=pointer]
                  - generic [ref=e371]: Tracksuits
                - generic [ref=e372]:
                  - generic [ref=e373]:
                    - generic [ref=e374]: €68
                    - generic [ref=e375]: €95
                  - button "Add Velour Tracksuit '94" [ref=e376] [cursor=pointer]:
                    - img [ref=e377]
                - generic [ref=e379]:
                  - img [ref=e380]
                  - text: Free returns
                  - generic [ref=e383]: €8
            - article [ref=e384]:
              - generic [ref=e385]:
                - generic [ref=e388]: SHELL SUIT — COBALT
                - generic:
                  - generic: "-25%"
                - button "Quick view" [ref=e389] [cursor=pointer]
                - button "Save to wishlist" [ref=e390] [cursor=pointer]:
                  - img [ref=e391]
              - generic [ref=e393]:
                - generic [ref=e394]:
                  - heading "Shell Suit — Cobalt" [level=3] [ref=e395] [cursor=pointer]
                  - generic [ref=e396]: Tracksuits
                - generic [ref=e397]:
                  - generic [ref=e398]:
                    - generic [ref=e399]: €54
                    - generic [ref=e400]: €72
                  - button "Add Shell Suit — Cobalt" [ref=e401] [cursor=pointer]:
                    - img [ref=e402]
                - generic [ref=e404]:
                  - img [ref=e405]
                  - text: Free returns
                  - generic [ref=e408]: €8
            - article [ref=e409]:
              - generic [ref=e410]:
                - generic [ref=e413]: WINDBREAKER HALF-ZIP
                - generic:
                  - generic: "-26%"
                - button "Quick view" [ref=e414] [cursor=pointer]
                - button "Save to wishlist" [ref=e415] [cursor=pointer]:
                  - img [ref=e416]
              - generic [ref=e418]:
                - generic [ref=e419]:
                  - heading "Windbreaker Half-Zip" [level=3] [ref=e420] [cursor=pointer]
                  - generic [ref=e421]: Tracksuits
                - generic [ref=e422]:
                  - generic [ref=e423]:
                    - generic [ref=e424]: €58
                    - generic [ref=e425]: €78
                  - button "Add Windbreaker Half-Zip" [ref=e426] [cursor=pointer]:
                    - img [ref=e427]
                - generic [ref=e429]:
                  - img [ref=e430]
                  - text: Free returns
                  - generic [ref=e433]: €8
        - generic [ref=e434]:
          - heading "Shoes" [level=3] [ref=e435]
          - generic [ref=e436]:
            - article [ref=e437]:
              - generic [ref=e438]:
                - generic [ref=e441]: COURT CLASSIC LO
                - generic:
                  - generic: "-27%"
                  - generic: Only 5 left
                - button "Quick view" [ref=e442] [cursor=pointer]
                - button "Save to wishlist" [ref=e443] [cursor=pointer]:
                  - img [ref=e444]
              - generic [ref=e446]:
                - generic [ref=e447]:
                  - heading "Court Classic Lo" [level=3] [ref=e448] [cursor=pointer]
                  - generic [ref=e449]: Shoes
                - generic [ref=e450]:
                  - generic [ref=e451]:
                    - generic [ref=e452]: €72
                    - generic [ref=e453]: €99
                  - button "Add Court Classic Lo" [ref=e454] [cursor=pointer]:
                    - img [ref=e455]
                - generic [ref=e457]:
                  - img [ref=e458]
                  - text: Free returns
                  - generic [ref=e461]: €8
            - article [ref=e462]:
              - generic [ref=e463]:
                - generic [ref=e466]: SUEDE RUNNER '88
                - generic:
                  - generic: "-23%"
                - button "Quick view" [ref=e467] [cursor=pointer]
                - button "Save to wishlist" [ref=e468] [cursor=pointer]:
                  - img [ref=e469]
              - generic [ref=e471]:
                - generic [ref=e472]:
                  - heading "Suede Runner '88" [level=3] [ref=e473] [cursor=pointer]
                  - generic [ref=e474]: Shoes
                - generic [ref=e475]:
                  - generic [ref=e476]:
                    - generic [ref=e477]: €85
                    - generic [ref=e478]: €110
                  - button "Add Suede Runner '88" [ref=e479] [cursor=pointer]:
                    - img [ref=e480]
                - generic [ref=e482]:
                  - img [ref=e483]
                  - text: Free returns
                  - generic [ref=e486]: €8
            - article [ref=e487]:
              - generic [ref=e488]:
                - generic [ref=e491]: HI-TOP RETRO
                - generic:
                  - generic: "-26%"
                - button "Quick view" [ref=e492] [cursor=pointer]
                - button "Save to wishlist" [ref=e493] [cursor=pointer]:
                  - img [ref=e494]
              - generic [ref=e496]:
                - generic [ref=e497]:
                  - heading "Hi-Top Retro" [level=3] [ref=e498] [cursor=pointer]
                  - generic [ref=e499]: Shoes
                - generic [ref=e500]:
                  - generic [ref=e501]:
                    - generic [ref=e502]: €78
                    - generic [ref=e503]: €105
                  - button "Add Hi-Top Retro" [ref=e504] [cursor=pointer]:
                    - img [ref=e505]
                - generic [ref=e507]:
                  - img [ref=e508]
                  - text: Free returns
                  - generic [ref=e511]: €8
        - generic [ref=e512]:
          - heading "Ralph Lauren — Polos" [level=3] [ref=e513]
          - article [ref=e515]:
            - generic [ref=e516]:
              - generic [ref=e519]: RALPH LAUREN - POLO - TOKYO
              - generic:
                - generic: "-40%"
                - generic: Only 5 left
              - button "Quick view" [ref=e520] [cursor=pointer]
              - button "Save to wishlist" [ref=e521] [cursor=pointer]:
                - img [ref=e522]
            - generic [ref=e524]:
              - generic [ref=e525]:
                - heading "Ralph Lauren - Polo - Tokyo" [level=3] [ref=e526] [cursor=pointer]
                - generic [ref=e527]: Polos
              - generic [ref=e528]:
                - generic [ref=e529]:
                  - generic [ref=e530]: €45
                  - generic [ref=e531]: €74.99
                - button "Add Ralph Lauren - Polo - Tokyo" [ref=e532] [cursor=pointer]:
                  - img [ref=e533]
              - generic [ref=e535]:
                - img [ref=e536]
                - text: Free returns
                - generic [ref=e539]: €8
  - contentinfo [ref=e540]:
    - generic [ref=e541]:
      - generic [ref=e542]: REWIND.
      - paragraph [ref=e543]: Curated vintage & retro sportswear. Each piece is one of one — sourced, authenticated, and sent on within a day.
    - generic [ref=e544]:
      - generic [ref=e545]:
        - heading "Shop" [level=4] [ref=e546]
        - generic [ref=e547] [cursor=pointer]: Tracksuits
        - generic [ref=e548] [cursor=pointer]: Jerseys
        - generic [ref=e549] [cursor=pointer]: Sets
        - generic [ref=e550] [cursor=pointer]: Kicks
      - generic [ref=e551]:
        - heading "Help" [level=4] [ref=e552]
        - generic [ref=e553] [cursor=pointer]: Sizing
        - generic [ref=e554] [cursor=pointer]: Shipping
        - generic [ref=e555] [cursor=pointer]: Returns
        - generic [ref=e556] [cursor=pointer]: Track order
      - generic [ref=e557]:
        - heading "Pay with" [level=4] [ref=e558]
        - generic [ref=e559] [cursor=pointer]: PayPal
        - generic [ref=e560] [cursor=pointer]: Payconiq
        - generic [ref=e561] [cursor=pointer]: Apple Pay
        - generic [ref=e562] [cursor=pointer]: Bancontact
        - generic [ref=e563] [cursor=pointer]: Klarna
    - generic [ref=e564]: © 2026 REWIND. A prototype. Prices & stock illustrative.
  - generic [ref=e565]:
    - generic [ref=e566]:
      - heading "Bag" [level=3] [ref=e567]
      - button "Close" [ref=e568] [cursor=pointer]:
        - img [ref=e569]
    - generic [ref=e571]:
      - img [ref=e572]
      - text: Add €108 more for free shipping
    - generic [ref=e583]:
      - generic [ref=e584]:
        - heading "Brasil '02 Jersey" [level=4] [ref=e585]
        - button "Remove" [ref=e586] [cursor=pointer]:
          - img [ref=e587]
      - generic [ref=e589]: S
      - generic [ref=e590]:
        - generic [ref=e591]:
          - button "Decrease" [ref=e592] [cursor=pointer]:
            - img [ref=e593]
          - generic [ref=e594]: "1"
          - button "Increase" [ref=e595] [cursor=pointer]:
            - img [ref=e596]
        - generic [ref=e598]: €42
    - generic [ref=e599]:
      - generic [ref=e600]:
        - generic [ref=e601]: Subtotal
        - generic [ref=e602]: €42
      - button "Checkout" [ref=e603] [cursor=pointer]:
        - text: Checkout
        - img [ref=e604]
      - generic [ref=e606]:
        - generic [ref=e607]: Card
        - generic [ref=e608]: PayPal
        - generic [ref=e609]: Payconiq
        - generic [ref=e610]: Apple Pay
        - generic [ref=e611]: Bancontact
        - generic [ref=e612]: Klarna
  - generic [ref=e613]:
    - generic [ref=e614]:
      - generic [ref=e615]: REWIND.
      - button "Close" [ref=e616] [cursor=pointer]
    - generic [ref=e617]:
      - img [ref=e619]
      - heading "Order confirmed" [level=2] [ref=e621]
      - paragraph [ref=e622]: Thanks for your order! We'll send you a shipping confirmation once your items are on their way.
      - generic [ref=e623]: RW-59878249
      - button "Continue shopping" [ref=e624] [cursor=pointer]
  - generic [ref=e625]:
    - generic [ref=e626]:
      - heading "Wishlist (0)" [level=3] [ref=e627]:
        - text: Wishlist
        - generic [ref=e628]: (0)
      - button "Close" [ref=e629] [cursor=pointer]:
        - img [ref=e630]
    - generic [ref=e632]:
      - img [ref=e633]
      - paragraph [ref=e635]: Your wishlist is empty
```

# Test source

```ts
  303 |     const visibleCards = page.locator('.rw-card:visible');
  304 |     const count = await visibleCards.count().catch(() => 0);
  305 |     if (count > 0) {
  306 |       // If results exist, they should contain "Jersey"
  307 |       const firstTitle = await visibleCards.first().locator('h3').textContent();
  308 |       expect(firstTitle?.toLowerCase()).toContain('jersey');
  309 |     }
  310 | 
  311 |     // Clear search
  312 |     await search.fill('');
  313 |     await page.waitForTimeout(300);
  314 |     const afterClear = page.locator('.rw-card:visible');
  315 |     expect(await afterClear.count()).toBeGreaterThan(0);
  316 |   });
  317 | });
  318 | 
  319 | // ── Cart lifecycle ──────────────────────────────────────────────
  320 | test.describe('Cart lifecycle', () => {
  321 |   test.beforeEach(async ({ page }) => {
  322 |     await page.goto(BASE, { waitUntil: 'networkidle' });
  323 |   });
  324 | 
  325 |   test('add to bag and cart operations work', async ({ page }) => {
  326 |     // ── Add an item via quick view ──
  327 |     const firstCard = page.locator('.rw-card').first();
  328 |     await firstCard.scrollIntoViewIfNeeded();
  329 |     await page.waitForTimeout(200);
  330 |     await firstCard.hover({ force: true });
  331 |     await firstCard.locator('.rw-add').click({ force: true });
  332 |     await page.waitForTimeout(500);
  333 | 
  334 |     // Toast should appear
  335 |     await expect(page.locator('.rw-toast')).toBeVisible({ timeout: 3000 });
  336 | 
  337 |     // ── Open cart drawer ──
  338 |     await page.waitForTimeout(300);
  339 |     const cartIcon = page.getByLabel('Cart');
  340 |     await cartIcon.click({ force: true });
  341 |     await page.waitForTimeout(400);
  342 | 
  343 |     const drawer = page.locator('.rw-drawer.is-on');
  344 |     await expect(drawer).toBeVisible();
  345 |     await expect(drawer.locator('h4')).toBeVisible();
  346 | 
  347 |     // ── Increase qty ──
  348 |     await drawer.locator('.rw-qty button').last().click();
  349 |     await page.waitForTimeout(200);
  350 | 
  351 |     // ── Decrease ──
  352 |     await drawer.locator('.rw-qty button').first().click();
  353 |     await page.waitForTimeout(200);
  354 | 
  355 |     // ── Remove ──
  356 |     const removeBtn = drawer.locator('button[aria-label="Remove"]');
  357 |     if (await removeBtn.count() > 0) {
  358 |       await removeBtn.click();
  359 |       await page.waitForTimeout(300);
  360 |     }
  361 | 
  362 |     // ── Close ──
  363 |     await drawer.locator('button[aria-label="Close"]').first().click({ force: true });
  364 |     await page.waitForTimeout(300);
  365 |   });
  366 | 
  367 |   test('full checkout flow places order', async ({ page }) => {
  368 |     // Add item
  369 |     const firstCard = page.locator('.rw-card').first();
  370 |     await firstCard.scrollIntoViewIfNeeded();
  371 |     await page.waitForTimeout(200);
  372 |     await firstCard.hover({ force: true });
  373 |     await firstCard.locator('.rw-add').click({ force: true });
  374 |     await page.waitForTimeout(500);
  375 | 
  376 |     // Open cart
  377 |     await page.waitForTimeout(300);
  378 |     const cartIcon = page.getByLabel('Cart');
  379 |     await cartIcon.click({ force: true });
  380 |     await page.waitForTimeout(400);
  381 | 
  382 |     // Checkout
  383 |     const drawer = page.locator('.rw-drawer.is-on');
  384 |     const checkoutBtn = drawer.locator('button:has-text("Checkout")');
  385 |     await expect(checkoutBtn).toBeVisible({ timeout: 3000 });
  386 |     await checkoutBtn.click();
  387 |     await page.waitForTimeout(500);
  388 | 
  389 |     // Should see checkout page
  390 |     const checkoutPage = page.locator('.rw-checkout');
  391 |     await expect(checkoutPage).toBeVisible({ timeout: 3000 });
  392 |     await expect(checkoutPage.locator('h3:has-text("Contact")')).toBeVisible();
  393 |     await expect(checkoutPage.locator('h3:has-text("Delivery")')).toBeVisible();
  394 |     await expect(checkoutPage.locator('h3:has-text("Payment")')).toBeVisible();
  395 |     await expect(checkoutPage.locator('h3:has-text("Order summary")')).toBeVisible();
  396 |     await expect(checkoutPage.locator('text=Shipping')).toBeVisible();
  397 | 
  398 |     // Place order — target the main action button (not payment method toggles)
  399 |     await checkoutPage.locator('.rw-btn-pri:has-text("Pay")').click();
  400 |     await page.waitForTimeout(3000);
  401 | 
  402 |     // Should see confirmation
> 403 |     await expect(page.locator('.rw-confirm, h2:has-text("Order confirmed")')).toBeVisible({ timeout: 5000 });
      |                                                                               ^ Error: expect(locator).toBeVisible() failed
  404 |   });
  405 | });
  406 | 
  407 | // ── Backend API tests ──────────────────────────────────────────
  408 | test.describe('Backend API endpoints', () => {
  409 |   test('/api/send-order responds', async ({ page }) => {
  410 |     const res = await page.request.post(`${BASE}/api/send-order`, {
  411 |       data: { email: 'test@test.com', name: 'Test', items: [{ name: 'Test Item', size: 'M', price: 42 }], total: 42, orderNum: 'RW-TEST' },
  412 |     });
  413 |     expect(res.status()).toBe(200);
  414 |     const body = await res.json();
  415 |     // Should have ok:true even if Resend not configured
  416 |     expect(body.ok ?? body.note).toBeTruthy();
  417 |   });
  418 | 
  419 |   test('/api/send-campaign responds', async ({ page }) => {
  420 |     const res = await page.request.post(`${BASE}/api/send-campaign`, {
  421 |       data: { emails: ['test@test.com'], subject: 'Test', message: 'Test message' },
  422 |     });
  423 |     expect(res.status()).toBe(200);
  424 |     const body = await res.json();
  425 |     expect(body).toHaveProperty('sent');
  426 |     expect(body).toHaveProperty('total');
  427 |   });
  428 | 
  429 |   test('/api/run-tests endpoint exists', async ({ page }) => {
  430 |     const res = await page.request.get(`${BASE}/api/run-tests`);
  431 |     // Should respond, even if with an error (server-side Playwright may not be installed)
  432 |     expect([200, 500]).toContain(res.status());
  433 |     const body = await res.json();
  434 |     expect(body).toHaveProperty('passed');
  435 |     expect(body).toHaveProperty('failed');
  436 |     expect(body).toHaveProperty('total');
  437 |   });
  438 | 
  439 |   test('static files served correctly', async ({ page }) => {
  440 |     // Check that JS bundle is served with correct MIME type
  441 |     const html = await (await page.goto(BASE, { waitUntil: 'networkidle' }))?.text();
  442 |     const match = html?.match(/src="(\/assets\/[^"]+\.js)"/);
  443 |     if (match) {
  444 |       const jsRes = await page.request.get(`${BASE}${match[1]}`);
  445 |       expect(jsRes.status()).toBe(200);
  446 |       expect(jsRes.headers()['content-type']).toContain('javascript');
  447 |     }
  448 |   });
  449 | });
  450 | 
  451 | // ── Concurrent / Stress tests ──────────────────────────────────
  452 | test.describe('Stress / concurrency', () => {
  453 |   test('multiple concurrent homepage loads', async ({ browser }) => {
  454 |     const pages = await Promise.all(
  455 |       Array.from({ length: 5 }, () => browser.newPage())
  456 |     );
  457 |     try {
  458 |       const results = await Promise.allSettled(
  459 |         pages.map((p) => p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 }))
  460 |       );
  461 |       const succeeded = results.filter(r => r.status === 'fulfilled' && r.value?.status() === 200).length;
  462 |       expect(succeeded).toBeGreaterThanOrEqual(4); // At least 4/5 should succeed
  463 |     } finally {
  464 |       await Promise.all(pages.map((p) => p.close()));
  465 |     }
  466 |   });
  467 | 
  468 |   test('concurrent API calls to send-order', async ({ page }) => {
  469 |     const responses = await Promise.allSettled(
  470 |       Array.from({ length: 5 }, (_, i) =>
  471 |         page.request.post(`${BASE}/api/send-order`, {
  472 |           data: { email: `stress${i}@test.com`, name: 'Stress', items: [], total: 0, orderNum: `RW-STRESS-${i}` },
  473 |         })
  474 |       )
  475 |     );
  476 |     const ok = responses.filter(r => r.status === 'fulfilled' && r.value?.status() === 200).length;
  477 |     expect(ok).toBeGreaterThanOrEqual(3); // At least 3/5
  478 |   });
  479 | });
  480 | 
  481 | // ── Export for admin panel integration ─────────────────────────
  482 | export async function runTests() {
  483 |   const { chromium } = await import('playwright');
  484 |   const browser = await chromium.launch({ headless: true });
  485 |   const results = [];
  486 |   let passed = 0;
  487 |   let failed = 0;
  488 | 
  489 |   async function check(name, fn) {
  490 |     const context = await browser.newContext();
  491 |     const page = await context.newPage();
  492 |     try {
  493 |       await fn(page);
  494 |       results.push({ name, status: '✅', detail: 'Passed' });
  495 |       passed++;
  496 |     } catch (e) {
  497 |       results.push({ name, status: '❌', detail: e.message?.slice(0, 100) || 'Unknown error' });
  498 |       failed++;
  499 |     } finally {
  500 |       await context.close();
  501 |     }
  502 |   }
  503 | 
```