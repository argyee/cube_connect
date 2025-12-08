import {ComponentPreview, Previews} from '@react-buddy/ide-toolbox'
import {PaletteTree} from './palette'
import {GameProvider} from "../context/GameContext.jsx";

const ComponentPreviews = () => {
    return (
        <Previews palette={<PaletteTree/>}>
            <ComponentPreview path="/GameProvider">
                <GameProvider/>
            </ComponentPreview>
        </Previews>
    )
}

export default ComponentPreviews