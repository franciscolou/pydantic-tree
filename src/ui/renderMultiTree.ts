import type { ClassNode } from '../types';
import { Svg, Group, HtmlRoot } from './components';
import { buildTreeLayout } from './render';
import { renderBaseStyles, renderViewportScript } from './viewport';

const TREE_GAP = 300;

export function renderMultiTreeSVG(
    trees: Array<{ focus: ClassNode; ancestorLayers: ClassNode[][]; descendantLayers: ClassNode[][] }>
): string {
    const layouts = trees.map(t =>
        buildTreeLayout(t.focus, t.ancestorLayers, t.descendantLayers)
    );

    const centersX: number[] = [];
    let cursorX = 0;
    for (const layout of layouts) {
        cursorX += layout.halfWidth;
        centersX.push(cursorX);
        cursorX += layout.halfWidth + TREE_GAP;
    }

    const allSvg = layouts
        .map((layout, i) =>
            Group({ transform: `translate(${centersX[i]}, 0)`, children: layout.svg })
        )
        .join('');

    return HtmlRoot(
        Svg({
            width: '100%',
            height: '100vh',
            children:
                renderBaseStyles() +
                Group({
                    id: 'viewport',
                    transform: 'translate(0,0) scale(1)',
                    children: allSvg,
                }),
        }) +
        renderViewportScript({ initialScale: 0.5 })
    );
}
