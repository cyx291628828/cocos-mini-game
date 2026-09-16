/* HUD 数值框组件：挂到编辑器搭建的数值框节点上，代码调用 sync 填数值 */
import { _decorator, Component, Label } from 'cc'
const { ccclass, property } = _decorator

@ccclass('HudBox')
export class HudBox extends Component {
    @property({ type: Label, tooltip: '显示数值的 Label（拖进来）' })
    valueLabel: Label = null!

    @property({ tooltip: '数据键：coins / dice / pieces' })
    bind: string = 'coins'

    sync(value: string): void {
        if (this.valueLabel) this.valueLabel.string = value
    }
}
