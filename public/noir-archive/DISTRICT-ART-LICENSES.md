# Noir district artwork register

Eleven district originals were generated with the built-in OpenAI image generation tool. Each is a separate generation request. Existing Midnight Chorus cover, map and finale artwork is retained unchanged.

Each original supplies a CSS-cropped cover and a full district map background. The two WebP files deliberately share a source and hash; they do not imply two separate commissioned illustrations. All are 1536×1024 and at most 360,000 bytes per file. No labels, UI, case facts or characters are baked into the artwork.

License/source label: OpenAI generated original. Exact prompts, source PNG hashes and output hashes are preserved in `district-art-manifest.json`; local source PNGs and their original output locations are preserved under `outputs/noir-art-sources/` in the project workspace.

| District | Files | Bytes per file | SHA-256 |
| --- | --- | ---: | --- |
| town-reckoning | town-reckoning/cover.webp; town-reckoning/map.webp | 317980 | b60f79aad16bc090d8c0cfc5316d3a2e686182a2778d21c8f12b8809d0268822 |
| clinic-headlines | clinic-headlines/cover.webp; clinic-headlines/map.webp | 299756 | 40b59961d61ffcb7b52f5d844633c5212df1852a4ad9c21ce6dd4ea1f5ce1d55 |
| scholarly-silence | scholarly-silence/cover.webp; scholarly-silence/map.webp | 340736 | 4a3c53696b2e51b9f1c27f88d3ab61a4efd47e7dd50d6085d793a56ee64759a8 |
| memorial-trust | memorial-trust/cover.webp; memorial-trust/map.webp | 248748 | 3f9d746cdd9ab055677c5fcd3bb076517b4e43f9f73d5c2e5fac5472fb8ac900 |
| harbor-testimony | harbor-testimony/cover.webp; harbor-testimony/map.webp | 269302 | 671b85ab6658763cdab627f9fc3a551818b5e45ccb36eaed65d29e446004bfe4 |
| railbound-alibi | railbound-alibi/cover.webp; railbound-alibi/map.webp | 297758 | 4840e7deb0929036a4ef8ddb9ebfb454b8d290d326c0a96aaa8b77f1bbb6889f |
| furnace-oath | furnace-oath/cover.webp; furnace-oath/map.webp | 319192 | 7d0f4306a27f506631604b4d07aa0fa1a831625bcfbb972d8456f3edcc490362 |
| floodgate-covenant | floodgate-covenant/cover.webp; floodgate-covenant/map.webp | 299556 | 818bea0b50189cb67c7e2cd9f7ce1b86dbf1ba17cf1a582700c173760b6589e9 |
| grand-hotel-register | grand-hotel-register/cover.webp; grand-hotel-register/map.webp | 268872 | c8fb1b9b98b759185712a11d1c30ada61b903573427cf771695656f3c806cb08 |
| blackout-ledger | blackout-ledger/cover.webp; blackout-ledger/map.webp | 303130 | 97646b395cad0a601116c3093ce69eabc6535c415889d21f77bdbb15d6450d65 |
| wireless-shadows | wireless-shadows/cover.webp; wireless-shadows/map.webp | 272266 | dfd648dc9b1d2a7de85a6a0aefe711d4b795e012ebc08695d802829a45016d72 |

Ready status is registered only after checking actual encoded files, dimensions, byte budgets and hashes. Planned chapter/finale/portrait/evidence slots are not marked ready by this addition.
