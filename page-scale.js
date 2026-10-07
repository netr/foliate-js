// A page scale shows a section laid out at one size (a reader's page) at another (the preview's screen).
// The scale is a transform on the section's own root, never on an ancestor of its iframe: WebKit draws a
// transformed iframe as a bitmap of its unscaled size and stretches it, which blurs or speckles the text,
// while a transform inside the document draws the glyphs at their final size. A transform never changes
// layout, so the section lays out exactly as it would at the reader's size.

/**
 * The section's page size in its own CSS px, and the scale that draws it onto the container. The page is
 * the whole pixel an unscaled container of the reader's size would measure, and the scale maps one page
 * of the section onto exactly one scroll step of the container (its client size).
 */
export function documentPage({ clientWidth, clientHeight, exactWidth, exactHeight, vertical }, pageScale) {
    if (pageScale === 1) {
        return { width: clientWidth, height: clientHeight, scale: 1 }
    }
    const width = Math.round(exactWidth / pageScale)
    const height = Math.round(exactHeight / pageScale)
    const scale = vertical ? clientHeight / height : clientWidth / width
    return { width, height, scale }
}

/** The section root's transform for a page drawn at `scale`. */
export function scaledRootStyles(scale) {
    return {
        transform: scale === 1 ? 'none' : `scale(${scale})`,
        'transform-origin': '0 0',
    }
}

const VIEWPORT_LENGTH = /(^|[^\w.-])(-?\d*\.?\d+)(vmin|vmax|[sld]?vh|[sld]?vw)(?![\w.-])/gi

/**
 * A scaled section's viewport is the container, not its page, so the book's viewport lengths are
 * measured against variables that pageViewportStyles sets to the page. Unset, they are the viewport.
 */
export function viewportUnitsOfPage(css) {
    // An @supports condition is a feature test, not a length: odd parts are those preludes.
    return css.split(/(@supports[^{]*\{)/).map((part, i) => i % 2 ? part : part.replace(VIEWPORT_LENGTH, (_, before, number, unit) => {
        const base = unit.toLowerCase().replace(/^[sld](?=v[hw]$)/, '')
        return `${before}calc(${number} * var(--page-${base}, 1${base}))`
    })).join('')
}

/** The section page's viewport lengths, for a section laid out at `page` and drawn at `scale`. */
export function pageViewportStyles({ width, height }, scale) {
    if (scale === 1) {
        return { '--page-vw': '1vw', '--page-vh': '1vh', '--page-vmin': '1vmin', '--page-vmax': '1vmax' }
    }
    return {
        '--page-vw': `${width / 100}px`,
        '--page-vh': `${height / 100}px`,
        '--page-vmin': `${Math.min(width, height) / 100}px`,
        '--page-vmax': `${Math.max(width, height) / 100}px`,
    }
}
