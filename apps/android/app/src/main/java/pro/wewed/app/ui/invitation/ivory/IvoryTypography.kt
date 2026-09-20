package pro.wewed.app.ui.invitation.ivory

import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import pro.wewed.app.R

/**
 * The invitation's own typefaces.
 *
 * The script face is part of the approved stationery, not a styling choice: substituting a
 * system face because it "looks elegant" is the same class of error as redrawing the flowers.
 * `GreatVibes-Regular.ttf` is imported byte-identical from `origin/main:public/fonts/`, where the
 * web loads it as `@font-face { font-family: IvoryScript }`.
 *
 * The split follows `ivory-floral-gold.css` exactly:
 *
 * ```
 * .ivory-names, .ivory-tagline   IvoryScript          the couple, and their line
 * .ivory-stage (everything else) Georgia, serif       including the seal monogram
 * ```
 */
object IvoryTypography {

    /** `@font-face { font-family: IvoryScript; src: GreatVibes-Regular.ttf }`. */
    val Script = FontFamily(Font(R.font.great_vibes_regular, FontWeight.Normal))

    /**
     * `.ivory-stage { font-family: Georgia, serif }`.
     *
     * Android has no Georgia; its serif is the closest available roman face, and unlike the script
     * it is a body face whose exact identity the design does not depend on.
     */
    val Body = FontFamily.Serif
}
