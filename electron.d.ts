declare namespace electron {
    interface Bounds {
        x: number,
        y: number,
        width: number,
        height: number
    }

    const remote: {
        getCurrentWindow(): {
            getBounds(): Bounds
        }

        screen: {
            getDisplayMatching(bounds: Bounds): {
                bounds: Bounds
            }
        }
    }
}