/**
 * Lightweight performance instrumentation for foliate-js.
 *
 * Zero-cost when disabled — every method early-returns.
 * Uses performance.mark() / performance.measure() for DevTools timeline
 * and console.debug() for structured log output (hidden by default).
 *
 * Enable:  foliatePerf.enable()
 * Disable: foliatePerf.disable()
 * Reset:   foliatePerf.reset()
 */

const PREFIX = 'foliate:'
const LOG_TAG = '[foliate-perf]'

class FoliatePerf {
    #enabled = false
    #accumulators = new Map()

    get enabled() { return this.#enabled }

    enable() {
        this.#enabled = true
        console.debug(`${LOG_TAG} profiling enabled`)
    }

    disable() {
        this.#enabled = false
        console.debug(`${LOG_TAG} profiling disabled`)
    }

    /** Clear all accumulated counters. */
    reset() {
        this.#accumulators.clear()
        // Clear any leftover performance marks
        performance.clearMarks()
        performance.clearMeasures()
    }

    /**
     * Start a named span. Returns { end(detail?) } to close it.
     * When ended, logs elapsed time and creates a performance.measure().
     *
     * Usage:
     *   const s = foliatePerf.span('epub.init')
     *   // ... work ...
     *   s.end()  // logs and records measure
     */
    span(name) {
        if (!this.#enabled) return noopSpan
        const markName = `${PREFIX}${name}`
        performance.mark(markName)
        const start = performance.now()
        return {
            end(detail) {
                const elapsed = performance.now() - start
                try {
                    performance.measure(`${PREFIX}${name}`, markName)
                } catch { /* mark may have been cleared */ }
                const extra = detail ? ` ${JSON.stringify(detail)}` : ''
                console.debug(`${LOG_TAG} ${name}: ${elapsed.toFixed(1)}ms${extra}`)
                return elapsed
            },
        }
    }

    /**
     * Get or create a named accumulator for summing N small operations.
     * Reports count, total, avg, and max when dump() is called.
     *
     * Usage:
     *   const acc = foliatePerf.accumulator('loader.src-replace')
     *   for (const img of images) {
     *       const t0 = performance.now()
     *       await replace(img)
     *       acc.add(performance.now() - t0)
     *   }
     *   acc.dump()  // logs summary
     */
    accumulator(name) {
        if (!this.#enabled) return noopAccumulator
        let acc = this.#accumulators.get(name)
        if (!acc) {
            acc = new Accumulator(name)
            this.#accumulators.set(name, acc)
        }
        return acc
    }

    /** Dump all accumulators and clear them. */
    dumpAll() {
        if (!this.#enabled) return
        for (const acc of this.#accumulators.values()) {
            acc.dump()
        }
        this.#accumulators.clear()
    }
}

class Accumulator {
    #name
    #count = 0
    #total = 0
    #max = 0

    constructor(name) {
        this.#name = name
    }

    get count() { return this.#count }
    get total() { return this.#total }

    add(elapsedMs) {
        this.#count++
        this.#total += elapsedMs
        if (elapsedMs > this.#max) this.#max = elapsedMs
    }

    dump() {
        if (this.#count === 0) return
        const avg = this.#total / this.#count
        console.debug(
            `${LOG_TAG}   ${this.#name}: count=${this.#count} total=${this.#total.toFixed(1)}ms avg=${avg.toFixed(1)}ms max=${this.#max.toFixed(1)}ms`,
        )
        try {
            performance.measure(`${PREFIX}${this.#name}`, {
                start: performance.now() - this.#total,
                duration: this.#total,
            })
        } catch { /* noop */ }
    }

    reset() {
        this.#count = 0
        this.#total = 0
        this.#max = 0
    }
}

// No-ops for when profiling is disabled — avoids branching at call sites
const noopSpan = Object.freeze({ end() { return 0 } })
const noopAccumulator = Object.freeze({
    count: 0,
    total: 0,
    add() {},
    dump() {},
    reset() {},
})

export const foliatePerf = new FoliatePerf()
