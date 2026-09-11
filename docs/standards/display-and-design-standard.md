# 434 MEDIA — Display and Design Standard

**Version 1.0 — September 10, 2026**
**Status: Approved. Governs how master-context records are presented on 434 MEDIA properties.**

The Master Contextual Document records what is true. This document records how it is displayed. Where the two conflict, the master wins on fact and this document wins on presentation.

Its purpose is to make presentation derivable rather than inferred. A new record should be publishable by anyone — or any agent — reading this document and the master, without studying existing pages to work out the pattern.

Structural rules and visual treatment are versioned separately. Section 2 is structural and changes rarely. Section 3 is visual and is expected to change; a change there does not reopen the master.

---

## 1. Scope

Governs the Work page and any surface rendering Section 4 portfolio records. Extends to other page types as they are added.

Which records appear is a master decision, not a display one. The Work page renders the records in master 4.8, 4.9, and 4.10 where the **Work page** field is absent or reads `Published`. A record marked `Not published` is not rendered, is not linked, and does not appear in counts.

## 2. Portfolio card — structural standard

### 2.1 Uniformity

Every portfolio card behaves identically. There is no card that behaves as a direct external link, no card without a detail view, and no card whose fields depend on what assets happen to exist.

A record missing an asset renders in its incomplete state. It does not change shape.

### 2.2 Tile

The tile is the card as it appears in the segment row.

Displays: the **name of the work**, and its still image.

Does not display: client name, funder, credits, status, or year. Attribution is not omitted — it moves to the detail view, per 2.3.

A record with no still renders as a title card. This is a supported state, not a defect.

### 2.3 Detail view

Opening a card opens a detail view. Every card has one.

Displays, in order:

1. Name of the work
2. Client, exactly as the master records it, including any funder construction (for example, "VelocityTX, funded through Methodist Healthcare Ministries")
3. 434 MEDIA role
4. Founder credit, in the master's controlled vocabulary (master 4.6)
5. Public description, verbatim from the record
6. Media — video where the record has one, still otherwise
7. External destination, where the record has one, as an action within the view

Never displays: internal context, proof-asset inventories, or any field the master marks internal.

### 2.4 External destinations

An external destination is an action inside the detail view, never a replacement for it. A card with a strong external home still opens its detail view first.

A record with no public destination shows no destination action. Its media is the demonstration of the work.

### 2.5 Segment rows

Cards are grouped by the three commercial models in master 4.3 — Original IP, Platforms for Brands, Productions for Brands — in that order.

Each segment is a single horizontal row with a visible affordance for scrolling to cards not currently on screen. The affordance must be obvious without hovering, and must work by touch and by pointer.

Vertical stacking of a segment's cards is not the standard.

### 2.6 Credit and attribution integrity

Names, credits, and descriptions are reproduced from the master exactly. Display never rewords a public description, abbreviates a credit, or substitutes a shorter client name.

Master 4.6 requires company credits and individual credits to be recorded separately. The detail view preserves that separation.

## 3. Visual treatment

Versioned independently of Section 2. Changing this section does not require a master change.

**Version 1.0 treatment:** carried forward from the current implementation of the ¿Qué es SDOH? card, which is the reference card for this standard.

Open items for a future revision: card dimensions and aspect ratio, typographic scale within the card, the scroll affordance's visual form, hover and focus states, and the detail view's layout at mobile width.

## 4. Implementation notes

A single card component serves every record. Adding a record must not require adding a component, a branch, or a special case.

Media handling: video is served as a compressed web derivative, not a master file. Autoplay without a poster and without `preload="metadata"` is not permitted — it pulls the full file on open.

## 5. Provisional items

- Section 3 in full; the visual treatment is inherited rather than specified
- Whether this standard extends to the About page and other record-rendering surfaces
- Detail-view behaviour for records with multiple videos or multiple stills
