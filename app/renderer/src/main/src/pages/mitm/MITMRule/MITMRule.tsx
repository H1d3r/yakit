import {Divider, Modal, Tooltip} from "antd"
import React, {ReactNode, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState} from "react"
import {
    MITMContentReplacerRule,
    MITMRuleProp,
    RuleExportAndImportButtonProps,
    YakitSwitchMemoProps
} from "./MITMRuleType"
import styles from "./MITMRule.module.scss"
import {
    BanIcon,
    ChevronDownIcon,
    ExportIcon,
    PencilAltIcon,
    PlusIcon,
    QuestionMarkCircleIcon,
    RefreshIcon,
    RemoveIcon,
    SaveIcon,
    TrashIcon
} from "@/assets/newIcon"
import {TableVirtualResize} from "@/components/TableVirtualResize/TableVirtualResize"
import {useCreation, useDebounceFn, useMemoizedFn, useThrottleFn} from "ahooks"
import {ColumnsTypeProps} from "@/components/TableVirtualResize/TableVirtualResizeType"
import classNames from "classnames"
import {YakitDrawer} from "@/components/yakitUI/YakitDrawer/YakitDrawer"
import {openExternalWebsite} from "@/utils/openWebsite"
import {YakitTag} from "@/components/yakitUI/YakitTag/YakitTag"
import {YakitSwitch} from "@/components/yakitUI/YakitSwitch/YakitSwitch"

import {YakitButton} from "@/components/yakitUI/YakitButton/YakitButton"
import {YakitSelect} from "@/components/yakitUI/YakitSelect/YakitSelect"
import {YakitMenu} from "@/components/yakitUI/YakitMenu/YakitMenu"
import {YakitPopover} from "@/components/yakitUI/YakitPopover/YakitPopover"
import {MITMRuleFromModal} from "./MITMRuleFromModal"
import {randomString} from "@/utils/randomUtil"
import {failed, success, warn, yakitNotify} from "@/utils/notification"
import {MITMRuleExport, MITMRuleImport} from "./MITMRuleConfigure/MITMRuleConfigure"
import update from "immutability-helper"
import {ExclamationCircleOutlined} from "@ant-design/icons"
import {YakitProtoSwitch} from "@/components/TableVirtualResize/YakitProtoSwitch/YakitProtoSwitch"
import {YakitCheckableTag} from "@/components/yakitUI/YakitTag/YakitCheckableTag"
import emiter from "@/utils/eventBus/eventBus"
import {shallow} from "zustand/shallow"
import {useMenuHeight} from "@/store/menuHeight"
import {WebsiteGV} from "@/enums/website"
import {
    grpcClientMITMContentReplacerUpdate,
    grpcMITMContentReplacers,
    MITMContentReplacersRequest
} from "../MITMHacker/utils"
import MITMContext from "../Context/MITMContext"
import ReactResizeDetector from "react-resize-detector"
import {YakitInput} from "@/components/yakitUI/YakitInput/YakitInput"
import {OutlineSearchIcon} from "@/assets/icon/outline"

const {ipcRenderer} = window.require("electron")

const HitColor = {
    red: {
        title: "红色",
        value: "red",
        className: "color-bg-red"
    },
    green: {
        title: "绿色",
        value: "green",
        className: "color-bg-green"
    },
    blue: {
        title: "蓝色",
        value: "blue",
        className: "color-bg-blue"
    },
    yellow: {
        title: "黄色",
        value: "yellow",
        className: "color-bg-yellow"
    },
    orange: {
        title: "橙色",
        value: "orange",
        className: "color-bg-orange"
    },
    purple: {
        title: "紫色",
        value: "purple",
        className: "color-bg-purple"
    },
    cyan: {
        title: "青色",
        value: "cyan",
        className: "color-bg-cyan"
    },
    grey: {
        title: "灰色",
        value: "grey",
        className: "color-bg-grey"
    }
}

const batchMenuData = (excludeBatchMenuKey: string) => {
    const arr = [
        {
            key: "ban",
            label: "禁用"
        },
        {
            key: "no-replace",
            label: "不替换"
        },
        {
            key: "replace",
            label: "替换"
        },
        {
            key: "remove",
            label: "删除"
        }
    ]
    try {
        const excludeBatchMenuKeyArr = JSON.parse(excludeBatchMenuKey) || []
        return arr.filter((ele) => !excludeBatchMenuKeyArr.includes(ele.key))
    } catch (error) {
        return arr
    }
}

export const colorSelectNode = (
    <>
        {Object.values(HitColor).map((item) => (
            <YakitSelect.Option value={item.value} key={item.value}>
                <div className={classNames(styles["table-hit-color-content"])}>
                    <div className={classNames(styles["table-hit-color"], item.className)} />
                    {item.title}
                </div>
            </YakitSelect.Option>
        ))}
    </>
)

const MITMRule: React.FC<MITMRuleProp> = React.memo(
    React.forwardRef((props, ref) => {
        const {menuBodyHeight} = useMenuHeight(
            (s) => ({
                menuBodyHeight: s.menuBodyHeight
            }),
            shallow
        )
        const {
            ruleUse = "mitm",
            visible,
            setVisible = () => {},
            getContainer,
            status,
            excludeColumnsKey = "",
            excludeBatchMenuKey = "",
            onSetRules,
            onRefreshCom,
            inMouseEnterTable = false
        } = props
        const mitmContent = useContext(MITMContext)

        const mitmVersion = useCreation(() => {
            return mitmContent.mitmStore.version
        }, [mitmContent.mitmStore.version])
        // 内容替代模块
        const [rules, setRules] = useState<MITMContentReplacerRule[]>([])
        const [originalRules, setOriginalRules] = useState<MITMContentReplacerRule[]>([])

        const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
        const [selectedRows, setSelectedRows] = useState<MITMContentReplacerRule[]>([])
        const [isAllSelect, setIsAllSelect] = useState<boolean>(false)
        const [loading, setLoading] = useState<boolean>(false)

        const [modalVisible, setModalVisible] = useState<boolean>(false)

        const [isRefresh, setIsRefresh] = useState<boolean>(false)

        const [isEdit, setIsEdit] = useState<boolean>(false)
        const [isAllBan, setIsAllBan] = useState<boolean>(false)
        const [isNoReplace, setIsNoReplace] = useState<boolean>(false)
        const [currentItem, setCurrentItem] = useState<MITMContentReplacerRule>()
        const [currentIndex, setCurrentIndex] = useState<number>()

        useImperativeHandle(
            ref,
            () => ({
                onSaveToDataBase: onSaveToDataBase
            }),
            []
        )

        const heightDrawer = useMemo(() => {
            return menuBodyHeight.firstTabMenuBodyHeight - 58
        }, [menuBodyHeight.firstTabMenuBodyHeight])

        const onSortRules = useMemoizedFn((newRule: MITMContentReplacerRule[]) => {
            let showRules: MITMContentReplacerRule[] = []
            let banRules: MITMContentReplacerRule[] = []
            newRule.forEach((item: MITMContentReplacerRule) => {
                if (item.Disabled) {
                    banRules.push(item)
                } else {
                    showRules.push(item)
                }
            })
            const newRules: MITMContentReplacerRule[] = [...showRules, ...banRules]
            return newRules
        })

        useEffect(() => {
            ipcRenderer.invoke("GetCurrentRules", {}).then((rsp: {Rules: MITMContentReplacerRule[]}) => {
                const newRules = rsp.Rules.map((ele) => ({...ele, Id: ele.Index}))
                setOriginalRules(newRules)
            })
        }, [visible])
        useEffect(() => {
            setAddRule([])
            clearnSearch()
            setTimeout(() => {
                onGetCurrentRules()
            }, 50)
        }, [visible])
        useEffect(() => {
            grpcClientMITMContentReplacerUpdate(mitmVersion).on((replacers) => {
                const newRules = (replacers || []).map((ele) => ({...ele, Id: ele.Index}))
                setRules(onSortRules(newRules))
            })
            return () => {
                grpcClientMITMContentReplacerUpdate(mitmVersion).remove()
            }
        }, [])
        const onGetCurrentRules = useMemoizedFn(() => {
            setLoading(true)
            ipcRenderer
                .invoke("GetCurrentRules", {})
                .then((rsp: {Rules: MITMContentReplacerRule[]}) => {
                    const newRules = rsp.Rules.map((ele) => ({...ele, Id: ele.Index}))
                    setRules(onSortRules(newRules))
                    setIsRefresh(!isRefresh)
                })
                .finally(() => setTimeout(() => setLoading(false), 100))
        })
        const setBanAndNoReplace = useMemoizedFn((rules: MITMContentReplacerRule[]) => {
            if (rules.length) {
                const listReplace = rules.filter((item) => item.NoReplace === false)
                const listDisabled = rules.filter((item) => item.Disabled === false)
                setIsNoReplace(listReplace.length === 0)
                setIsAllBan(listDisabled.length === 0)
            } else {
                setIsNoReplace(false)
                setIsAllBan(false)
            }
        })

        const onSelectAll = useMemoizedFn(
            (newSelectedRowKeys: string[], selected: MITMContentReplacerRule[], checked: boolean) => {
                if (checked) {
                    const rows = searchFlag
                        ? searchRules.filter((ele) => !ele.Disabled)
                        : rules.filter((ele) => !ele.Disabled)
                    setSelectedRowKeys(rows.map((ele: any) => ele.Id))
                    setSelectedRows(rows)
                } else {
                    setSelectedRowKeys([])
                    setSelectedRows([])
                }
                setIsAllSelect(checked)
            }
        )

        const onSelectChange = useMemoizedFn((c: boolean, keys: string, rows: MITMContentReplacerRule) => {
            if (c) {
                setSelectedRowKeys([...selectedRowKeys, keys])
                setSelectedRows([...selectedRows, rows])
            } else {
                setIsAllSelect(false)
                const newSelectedRowKeys = selectedRowKeys.filter((ele) => ele !== keys)
                const newSelectedRows = selectedRows.filter((ele) => ele.Id !== rows.Id)
                setSelectedRowKeys(newSelectedRowKeys)
                setSelectedRows(newSelectedRows)
            }
        })
        const onSetCurrentRow = useDebounceFn(
            (rowDate: MITMContentReplacerRule) => {
                setCurrentItem(rowDate)
            },
            {wait: 200}
        ).run
        const onRemove = useMemoizedFn((rowDate: MITMContentReplacerRule) => {
            setRules(rules.filter((t) => t.Id !== rowDate.Id))
        })

        const onOpenAddOrEdit = useMemoizedFn((rowDate?: MITMContentReplacerRule) => {
            setModalVisible(true)
            setIsEdit(true)
            setCurrentItem(rowDate)
        })
        const onBan = useMemoizedFn((rowDate: MITMContentReplacerRule) => {
            let showRules: MITMContentReplacerRule[] = []
            let banRules: MITMContentReplacerRule[] = []
            rules.forEach((item: MITMContentReplacerRule) => {
                if (item.Id === rowDate.Id) {
                    if (!rowDate.Disabled && rowDate.Id === currentItem?.Id) {
                        setCurrentItem(undefined)
                    }
                    item = {
                        ...rowDate,
                        Disabled: !rowDate.Disabled
                    }
                }
                if (item.Disabled) {
                    banRules.push(item)
                } else {
                    showRules.push(item)
                }
            })
            const newRules: MITMContentReplacerRule[] = [...showRules, ...banRules]
            setRules(newRules)
        })

        const rulesRangeList = useCreation(() => {
            return [
                {
                    label: "请求",
                    value: "EnableForRequest"
                },
                {
                    label: "响应",
                    value: "EnableForResponse"
                },
                {
                    label: "URI",
                    value: "EnableForURI"
                },
                {
                    label: "Header",
                    value: "EnableForHeader"
                },
                {
                    label: "Body",
                    value: "EnableForBody"
                }
            ]
        }, [])

        const columns: ColumnsTypeProps[] = useMemo<ColumnsTypeProps[]>(() => {
            const columnArr: ColumnsTypeProps[] = [
                {
                    title: "执行顺序",
                    dataKey: "Index",
                    fixed: "left",
                    width: 130
                },
                {
                    title: "规则名称",
                    dataKey: "VerboseName",
                    fixed: "left",
                    width: 150
                },
                {
                    title: "规则内容",
                    dataKey: "Rule",
                    width: 240
                },
                {
                    title: "替换结果",
                    dataKey: "NoReplace",
                    width: 350,
                    tip: "HTTP Header 与 HTTP Cookie 优先级较高，会覆盖文本内容",
                    beforeIconExtra: <div className={styles["table-result-extra"]}>开/关</div>,
                    render: (_, i: MITMContentReplacerRule) => (
                        <YakitSwitchMemo
                            ExtraCookies={i.ExtraCookies}
                            ExtraHeaders={i.ExtraHeaders}
                            Result={i.Result}
                            disabled={i.Disabled}
                            checked={!i.NoReplace}
                            onChange={(val) => {
                                onEdit({Id: i.Id, NoReplace: !val}, "NoReplace")
                            }}
                        />
                    )
                },
                {
                    title: "丢弃结果",
                    dataKey: "Drop",
                    width: 110,
                    tip: "设置开启替代之后，可丢弃当前请求/响应",
                    render: (_, i: MITMContentReplacerRule) => (
                        <YakitProtoSwitch
                            checked={i.Drop}
                            disabled={i.Disabled}
                            onChange={(val) => {
                                if (val) {
                                    onEdit({Id: i.Id, Drop: val, NoReplace: false}, "Drop")
                                } else {
                                    onEdit({Id: i.Id, Drop: val}, "Drop")
                                }
                            }}
                        />
                    )
                },
                {
                    title: "自动重发",
                    dataKey: "ExtraRepeat",
                    width: 110,
                    tip: "设置改选项后，将不会替换（请求）数据包，会把替换后的结果进行额外发包",
                    render: (_, i: MITMContentReplacerRule) => (
                        <YakitProtoSwitch
                            disabled={i.Disabled}
                            checked={i.ExtraRepeat}
                            onChange={(val) => {
                                if (val) {
                                    onEdit({Id: i.Id, ExtraRepeat: val, NoReplace: false}, "ExtraRepeat")
                                } else {
                                    onEdit({Id: i.Id, ExtraRepeat: val}, "ExtraRepeat")
                                }
                            }}
                        />
                    )
                },
                {
                    title: "规则作用范围",
                    dataKey: "EnableForRequest",
                    tip: "选择请求或响应后，Header和Body至少选择一个",
                    width: 280,
                    render: (_, record: MITMContentReplacerRule) => {
                        return (
                            <div>
                                {rulesRangeList.map((item) => (
                                    <YakitCheckableTag
                                        key={item.value}
                                        checked={record[item.value]}
                                        onChange={(checked) => {
                                            onEditRuleAction(checked, record, item)
                                        }}
                                        disable={record.Disabled}
                                    >
                                        {item.label}
                                    </YakitCheckableTag>
                                ))}
                            </div>
                        )
                    }
                },
                {
                    title: "生效url",
                    dataKey: "EffectiveURL",
                    width: 240
                },
                {
                    title: "命中颜色",
                    dataKey: "Color",
                    ellipsis: false,
                    width: 85,
                    render: (text, record: MITMContentReplacerRule) => (
                        <div className={classNames(styles["table-hit-color-content"])}>
                            <div className={classNames(styles["table-hit-color"], HitColor[text]?.className)} />
                            {HitColor[text]?.title || "-"}
                        </div>
                    )
                },
                {
                    title: "追加 Tag",
                    dataKey: "ExtraTag",
                    minWidth: 120,
                    render: (text, record: MITMContentReplacerRule) => (
                        <div
                            className={classNames({
                                [styles["action-icon-edit-disabled"]]: record.Disabled
                            })}
                        >
                            {text}
                        </div>
                    )
                },
                {
                    title: "操作",
                    dataKey: "action",
                    fixed: "right",
                    width: 128,
                    render: (_, record: MITMContentReplacerRule) => {
                        return (
                            <div className={styles["table-action-icon"]}>
                                <TrashIcon
                                    className={styles["icon-trash"]}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onRemove(record)
                                    }}
                                />
                                <PencilAltIcon
                                    className={classNames(styles["action-icon"], {
                                        [styles["action-icon-edit-disabled"]]: record.Disabled
                                    })}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onOpenAddOrEdit(record)
                                    }}
                                />
                                <BanIcon
                                    className={classNames(styles["action-icon"], {
                                        [styles["action-icon-ban-disabled"]]: record.Disabled
                                    })}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onBan(record)
                                    }}
                                />
                            </div>
                        )
                    }
                }
            ]

            try {
                const excludeColumnsKeyArr = JSON.parse(excludeColumnsKey) || []
                return columnArr.filter((ele) => !excludeColumnsKeyArr.includes(ele.dataKey))
            } catch (error) {
                return columnArr
            }
        }, [excludeColumnsKey])

        const onEditRuleAction = useMemoizedFn((checked: boolean, record: MITMContentReplacerRule, item) => {
            record[item.value] = checked
            const first = item.value === "EnableForRequest" || item.value === "EnableForResponse"
            const firstChecked = record["EnableForRequest"] || record["EnableForResponse"]
            const second =
                item.value === "EnableForHeader" || item.value === "EnableForBody" || item.value === "EnableForURI"
            const secondChecked = record["EnableForHeader"] || record["EnableForBody"] || record["EnableForURI"]
            // 请求和响应其中一个为true,那么 Header和Body必须要选中一个
            // 请求和响应都为false,那么 Header和Body都为 false
            if (first) {
                if (firstChecked) {
                    if (!secondChecked) {
                        record["EnableForHeader"] = true
                        record["EnableForBody"] = true
                        record["EnableForURI"] = true
                    }
                } else {
                    record["EnableForHeader"] = false
                    record["EnableForBody"] = false
                    record["EnableForURI"] = false
                }
            }
            if (second) {
                if (secondChecked) {
                    if (!firstChecked) {
                        record["EnableForRequest"] = true
                        record["EnableForResponse"] = true
                    }
                } else {
                    record["EnableForRequest"] = false
                    record["EnableForResponse"] = false
                }
            }
            const newRules: MITMContentReplacerRule[] = rules.map((item) => {
                if (item.Id === record.Id) {
                    item = record
                }
                return {...item}
            })
            setRules(newRules)
        })

        const onEdit = useMemoizedFn((record, text: string) => {
            const newRules: MITMContentReplacerRule[] = rules.map((item) => {
                if (item.Id === record.Id) {
                    item[text] = record[text]
                }
                return {...item}
            })
            setRules(newRules)
        })
        const onMenuSelect = useMemoizedFn((key: string) => {
            switch (key) {
                case "ban":
                    onBatchNoReplaceOrBan(true, "Disabled")
                    break
                case "replace":
                    onBatchNoReplaceOrBan(false, "NoReplace")
                    break
                case "no-replace":
                    onBatchNoReplaceOrBan(true, "NoReplace")
                    break
                case "remove":
                    onBatchRemove()
                    break
                default:
                    break
            }
        })
        const onOpenOrCloseModal = useMemoizedFn((b: boolean) => {
            if (b) {
                const index = rules.length + 1
                const defRowDate: MITMContentReplacerRule = {
                    EffectiveURL: "",
                    Color: "",
                    EnableForRequest: false,
                    EnableForResponse: true,
                    EnableForBody: true,
                    EnableForHeader: true,
                    EnableForURI: false,
                    Index: index,
                    Drop: false,
                    ExtraRepeat: false,
                    Id: index,
                    NoReplace: false,
                    Result: "",
                    Rule: "",
                    RegexpGroups: [],
                    ExtraTag: [],
                    Disabled: false,
                    VerboseName: "RULE:" + randomString(10),
                    ExtraCookies: [],
                    ExtraHeaders: []
                }
                setCurrentItem(defRowDate)
            } else {
                setIsEdit(false)
            }
            setModalVisible(b)
        })

        const onSaveRules = useMemoizedFn((val: MITMContentReplacerRule) => {
            const obj = {...val}
            if (ruleUse === "historyAnalysis") {
                obj.NoReplace = true
                obj.Result = ""
                obj.ExtraHeaders = []
                obj.ExtraCookies = []
                obj.Drop = false
                obj.ExtraRepeat = false
            }
            if (isEdit) {
                const index = rules.findIndex((item) => item.Id === val.Id)
                if (index === -1) return
                rules[index] = obj
                setRules(onSortRules([...rules]))
            } else {
                setAddRule((prev) => [obj, ...prev])
                const newRules = [obj, ...rules].sort((a, b) => a.Index - b.Index)
                setRules(onSortRules(newRules))
                setCurrentIndex(newRules.length - 1)
            }
            onOpenOrCloseModal(false)
        })
        const onRefreshCurrentRules = () => {
            if (ruleUse === "mitm") {
                emiter.emit("onRefreshCurrentRules")
            }
        }
        const onSaveToDataBase = useMemoizedFn((saveOk?: () => void) => {
            const newRules: MITMContentReplacerRule[] = rules.map((item, index) => ({...item, Index: index + 1}))
            if (status === "idle") {
                // 劫持未开启
                ipcRenderer
                    .invoke("SetCurrentRules", {Rules: newRules})
                    .then((e) => {
                        setVisible(false)
                        setAddRule([])
                        if (saveOk) {
                            saveOk()
                        } else {
                            success("保存成功")
                        }
                        onRefreshCurrentRules()
                    })
                    .catch((e) => {
                        failed(`保存失败: ${e}`)
                    })
            } else {
                // 开启劫持
                const findOpenRepRule = newRules.find(
                    (item) => !item.Disabled && (!item.NoReplace || item.Drop || item.ExtraRepeat)
                )
                if (ruleUse === "mitm" && findOpenRepRule !== undefined) {
                    Modal.confirm({
                        title: "温馨提示",
                        icon: <ExclamationCircleOutlined />,
                        content: "检测到开启了替换规则，可能会影响劫持，是否确认开启？",
                        okText: "确认",
                        cancelText: "取消",
                        closable: true,
                        centered: true,
                        closeIcon: (
                            <div
                                onClick={(e) => {
                                    e.stopPropagation()
                                    Modal.destroyAll()
                                }}
                                className='modal-remove-icon'
                            >
                                <RemoveIcon />
                            </div>
                        ),
                        cancelButtonProps: {size: "small", className: "modal-cancel-button"},
                        okButtonProps: {size: "small", className: "modal-ok-button"},
                        onOk: () => {
                            const value: MITMContentReplacersRequest = {
                                replacers: newRules,
                                version: mitmVersion
                            }
                            grpcMITMContentReplacers(value)
                                .then((val) => {
                                    emiter.emit("onRefreshRuleEvent", mitmVersion)
                                    setVisible(false)
                                    setAddRule([])
                                    if (saveOk) {
                                        saveOk()
                                    } else {
                                        success("保存成功")
                                    }
                                    onRefreshCurrentRules()
                                })
                                .catch((e) => {
                                    failed(`保存失败: ${e}`)
                                })
                        }
                    })
                } else {
                    const value: MITMContentReplacersRequest = {
                        replacers: newRules,
                        version: mitmVersion
                    }
                    grpcMITMContentReplacers(value)
                        .then((val) => {
                            emiter.emit("onRefreshRuleEvent", mitmVersion)
                            setVisible(false)
                            setAddRule([])
                            if (saveOk) {
                                saveOk()
                            } else {
                                success("保存成功")
                            }
                            onRefreshCurrentRules()
                        })
                        .catch((e) => {
                            failed(`保存失败: ${e}`)
                        })
                }
            }
        })
        useEffect(() => {
            const r = rules.map((item, index) => ({...item, Index: index + 1}))
            onSetRules && onSetRules(r)
            setBanAndNoReplace(r)
            setAddRule((prev) => {
                return prev.map((item) => {
                    const match = r.find((r) => r.Id === item.Id)
                    if (match) {
                        return {...match}
                    }
                    return item
                })
            })

            setSearchRules((prev) => {
                return prev
                    .map((item, index) => {
                        const edited = r.find((r) => r.Id == item.Id)
                        return edited ? edited : null
                    })
                    .filter(Boolean) as MITMContentReplacerRule[]
            })
        }, [rules])

        const onBatchNoReplaceOrBan = useMemoizedFn((checked: boolean, text: string) => {
            if (selectedRowKeys.length === 0) return
            setLoading(true)
            const newRules: MITMContentReplacerRule[] = rules.map((item) => {
                if (selectedRowKeys.findIndex((ele) => ele == `${item.Id}`) !== -1) {
                    item[text] = checked
                }
                return item
            })
            setRules(onSortRules([...newRules]))
            setSelectedRowKeys([])
            setIsAllSelect(false)
            setTimeout(() => {
                setLoading(false)
            }, 200)
        })

        const onBatchRemove = useMemoizedFn(() => {
            if (selectedRowKeys.length === 0) return
            setLoading(true)
            const newRules: MITMContentReplacerRule[] = []
            rules.forEach((item) => {
                if (selectedRowKeys.findIndex((ele) => ele == `${item.Id}`) === -1) {
                    newRules.push(item)
                }
            })
            setRules([...newRules])
            setSelectedRowKeys([])
            setIsAllSelect(false)
            setIsRefresh(!isRefresh)
            setTimeout(() => {
                setLoading(false)
            }, 200)
        })

        const onAllBan = useMemoizedFn((checked: boolean) => {
            setIsAllBan(checked)
            setLoading(true)
            const newRules: MITMContentReplacerRule[] = rules.map((item) => ({...item, Disabled: checked}))
            setRules(newRules)
            setSelectedRowKeys([])
            setIsAllSelect(false)
            setTimeout(() => {
                setLoading(false)
            }, 200)
        })
        const onAllNoReplace = useMemoizedFn((checked: boolean) => {
            setIsNoReplace(checked)
            setLoading(true)
            const newRules: MITMContentReplacerRule[] = []
            rules.forEach((item) => {
                if (item.Disabled) {
                    newRules.push(item)
                } else {
                    newRules.push({...item, NoReplace: checked})
                }
            })
            setRules(newRules)
            setSelectedRowKeys([])
            setIsAllSelect(false)
            setTimeout(() => {
                setLoading(false)
            }, 200)
        })

        const isAlowMoveRef = useRef<boolean>(true)
        const onMoveRow = useMemoizedFn((dragIndex: number, hoverIndex: number) => {
            setRules((prevRules: MITMContentReplacerRule[]) => {
                // PS: 未屏蔽的规则仅能在未屏蔽的规则中进行拖拽 屏蔽的规则仅能在屏蔽的规则中进行拖拽
                if (prevRules[dragIndex].Disabled !== prevRules[hoverIndex].Disabled || !isAlowMoveRef.current) {
                    if (isAlowMoveRef.current) {
                        warn("拖拽已失效，只能在同一状态下的规则中进行拖拽")
                    }
                    isAlowMoveRef.current = false
                    return prevRules
                }

                return update(prevRules, {
                    $splice: [
                        [dragIndex, 1],
                        [hoverIndex, 0, prevRules[dragIndex]]
                    ]
                })
            })
        })
        const onMoveRowEnd = useMemoizedFn(() => {
            isAlowMoveRef.current = true
            setRules((prevRules: MITMContentReplacerRule[]) => {
                const newRules = prevRules.map((item, index) => ({...item, Index: index + 1}))
                return [...newRules]
            })
        })

        const onOkImport = useMemoizedFn(() => {
            clearnSearch()
            setTimeout(() => {
                onGetCurrentRules()
            }, 50)
        })

        const onClose = useMemoizedFn(() => {
            if (JSON.stringify(originalRules) !== JSON.stringify(rules)) {
                Modal.confirm({
                    title: "温馨提示",
                    icon: <ExclamationCircleOutlined />,
                    content: "请问是否要保存规则内容并关闭弹框？",
                    okText: "保存",
                    cancelText: "不保存",
                    closable: true,
                    closeIcon: (
                        <div
                            onClick={(e) => {
                                e.stopPropagation()
                                Modal.destroyAll()
                            }}
                            className='modal-remove-icon'
                        >
                            <RemoveIcon />
                        </div>
                    ),
                    onOk: () => {
                        onSaveToDataBase()
                    },
                    onCancel: () => {
                        setVisible(false)
                    },
                    cancelButtonProps: {size: "small", className: "modal-cancel-button"},
                    okButtonProps: {size: "small", className: "modal-ok-button"}
                })
            } else {
                setVisible(false)
            }
        })

        const title = () => {
            return <div className={styles["heard-title"]}>内容规则配置</div>
        }
        const extra = () => {
            return (
                <div className={styles["heard-right-operation"]}>
                    <RuleExportAndImportButton onOkImport={onOkImport} />
                    <YakitButton type='primary' className={styles["button-save"]} onClick={() => onSaveToDataBase()}>
                        保存
                    </YakitButton>
                    {ruleUse === "mitm" && (
                        <>
                            <Tooltip title='官方网站' placement='top' overlayClassName={styles["question-tooltip"]}>
                                <YakitButton
                                    type='outline2'
                                    className={styles["button-question"]}
                                    onClick={() => openExternalWebsite(WebsiteGV.OfficialWebsite)}
                                    icon={<QuestionMarkCircleIcon />}
                                ></YakitButton>
                            </Tooltip>
                            <div onClick={() => onClose()} className={styles["icon-remove"]}>
                                <RemoveIcon />
                            </div>
                        </>
                    )}
                </div>
            )
        }

        const [addRule, setAddRule] = useState<MITMContentReplacerRule[]>([])
        const [tableTitleBodyWidth, setTableTitleBodyWidth] = useState<number>(0)
        const [valueSearch, setValueSearch] = useState<string>("")
        const [searchRules, setSearchRules] = useState<MITMContentReplacerRule[]>([])
        const [searchFlag, setSearchFlag] = useState<boolean>(false)
        const clearnSearch = useMemoizedFn(() => {
            setValueSearch("")
            setSearchFlag(false)
            setSearchRules([])
            setIsRefresh(!isRefresh)

            setSelectedRowKeys([])
            setSelectedRows([])
            setIsAllSelect(false)
        })
        const onSearch = useMemoizedFn((searchValue?: string) => {
            setLoading(true)
            const realValue = (searchValue || "").trim()
            if (realValue === "") {
                clearnSearch()
                setTimeout(() => setLoading(false), 100)
            } else {
                setSearchFlag(true)
                ipcRenderer
                    .invoke("QueryMITMReplacerRules", {KeyWord: realValue})
                    .then((rsp) => {
                        const newRules = rsp.Rules.Rules.map((ele) => ({...ele, Id: ele.Index}))
                        // 确保newRules为最新的rules数据
                        rules.forEach((item) => {
                            const idx = newRules.findIndex((i) => i.Id == item.Id)
                            if (idx !== -1) {
                                newRules[idx] = {
                                    ...item
                                }
                            }
                        })

                        // 只保留 rules 里还存在的项
                        const rulesIdSet = new Set(rules.map((item) => item.Id))
                        const filteredRules = newRules.filter((item) => rulesIdSet.has(item.Id))

                        // 新加规则 前端匹配搜索
                        const lower = realValue.toLowerCase()
                        const arr = addRule.filter((item) => {
                            return (
                                (item.VerboseName && item.VerboseName.toLowerCase().includes(lower)) ||
                                (item.Rule && item.Rule.toLowerCase().includes(lower))
                            )
                        })

                        setSearchRules([...filteredRules, ...arr].sort((a, b) => a.Index - b.Index))

                        setIsRefresh(!isRefresh)

                        setSelectedRowKeys([])
                        setSelectedRows([])
                        setIsAllSelect(false)
                    })
                    .finally(() => setTimeout(() => setLoading(false), 100))
            }
        })
        const searchEle = useMemo(() => {
            return (
                <YakitInput.Search
                    size='small'
                    placeholder='请输入关键字搜索'
                    style={{maxWidth: 200}}
                    value={valueSearch}
                    onChange={(e) => {
                        setValueSearch(e.target.value)
                    }}
                    onSearch={onSearch}
                    onPressEnter={(e) => {
                        e.preventDefault()
                        onSearch(e.currentTarget.value)
                    }}
                />
            )
        }, [valueSearch])

        const content = () => {
            return (
                <div className={styles["mitm-rule-table"]}>
                    <ReactResizeDetector
                        onResize={(width, height) => {
                            if (!width || !height) return
                            setTableTitleBodyWidth(width)
                        }}
                        handleWidth={true}
                        handleHeight={true}
                        refreshMode={"debounce"}
                        refreshRate={50}
                    />
                    <TableVirtualResize<MITMContentReplacerRule>
                        currentIndex={currentIndex}
                        isRefresh={isRefresh}
                        titleHeight={42}
                        title={
                            <div className={styles["table-title-body"]}>
                                <div className={styles["table-title"]}>现有 MITM 内容规则</div>
                                <div className={styles["table-total"]}>
                                    共 <span>{rules.length}</span> 条规则
                                </div>
                            </div>
                        }
                        extra={
                            <div className={styles["table-title-body"]}>
                                <div className={styles["table-search"]}>
                                    <>{tableTitleBodyWidth >= 670 && searchEle}</>
                                    <>
                                        {tableTitleBodyWidth < 670 && (
                                            <YakitPopover content={searchEle}>
                                                <YakitButton
                                                    icon={<OutlineSearchIcon />}
                                                    size='small'
                                                    type='outline2'
                                                    isHover={searchFlag}
                                                />
                                            </YakitPopover>
                                        )}
                                    </>
                                </div>
                                <div className={styles["table-switch"]}>
                                    <span className={styles["switch-text"]}>全部禁用</span>
                                    <YakitSwitch checked={isAllBan} onChange={(c) => onAllBan(c)} />
                                </div>
                                {ruleUse === "mitm" && (
                                    <>
                                        <Divider type='vertical' style={{margin: "0 16px"}} />
                                        <div className={styles["table-switch"]}>
                                            <span className={styles["switch-text"]}>全部不替换</span>
                                            <YakitSwitch checked={isNoReplace} onChange={(c) => onAllNoReplace(c)} />
                                        </div>
                                    </>
                                )}
                                <YakitPopover
                                    placement={"bottom"}
                                    arrowPointAtCenter={true}
                                    content={
                                        <YakitMenu
                                            data={batchMenuData(excludeBatchMenuKey)}
                                            selectedKeys={[]}
                                            width={92}
                                            onSelect={({key}) => onMenuSelect(key)}
                                        />
                                    }
                                    trigger='hover'
                                    overlayClassName={classNames(styles["popover-remove"])}
                                >
                                    <YakitButton
                                        type='outline2'
                                        disabled={selectedRowKeys.length === 0}
                                        className={classNames(styles["button-batch-remove"])}
                                    >
                                        批量操作
                                        <ChevronDownIcon />
                                    </YakitButton>
                                </YakitPopover>
                                <YakitButton type='primary' onClick={() => onOpenOrCloseModal(true)}>
                                    <div className={styles["button-add-rule"]}>
                                        <PlusIcon />
                                        新增规则
                                    </div>
                                </YakitButton>
                                {ruleUse === "historyAnalysis" && (
                                    <YakitButton
                                        style={{marginLeft: 8}}
                                        type='text2'
                                        icon={<RefreshIcon />}
                                        onClick={() => {
                                            onRefreshCom && onRefreshCom()
                                        }}
                                    />
                                )}
                            </div>
                        }
                        renderKey='Id'
                        data={searchFlag ? searchRules : rules}
                        rowSelection={{
                            isAll: isAllSelect,
                            type: "checkbox",
                            selectedRowKeys,
                            onSelectAll: onSelectAll,
                            onChangeCheckboxSingle: onSelectChange
                        }}
                        pagination={{
                            total: searchFlag ? searchRules.length : rules.length,
                            limit: 20,
                            page: 1,
                            onChange: () => {}
                        }}
                        loading={loading}
                        columns={columns}
                        currentSelectItem={currentItem}
                        onRowClick={onSetCurrentRow}
                        onMoveRow={onMoveRow}
                        enableDragSort={true}
                        enableDrag={true}
                        inMouseEnterTable={inMouseEnterTable}
                        onMoveRowEnd={onMoveRowEnd}
                    />
                </div>
            )
        }

        return (
            <>
                {ruleUse === "mitm" ? (
                    <YakitDrawer
                        placement='bottom'
                        closable={false}
                        onClose={() => onClose()}
                        visible={visible}
                        getContainer={getContainer}
                        mask={false}
                        style={{height: visible ? heightDrawer : 0}}
                        className={classNames(styles["mitm-rule-drawer"])}
                        contentWrapperStyle={{boxShadow: "0px -2px 4px rgba(133, 137, 158, 0.2)"}}
                        title={title()}
                        extra={extra()}
                    >
                        {content()}
                    </YakitDrawer>
                ) : (
                    <>
                        <div className={styles["header"]}>
                            <>{title()}</>
                            {extra()}
                        </div>
                        {content()}
                    </>
                )}
                {modalVisible && (
                    <MITMRuleFromModal
                        ruleUse={ruleUse}
                        rules={rules}
                        modalVisible={modalVisible}
                        isEdit={isEdit}
                        onClose={() => onOpenOrCloseModal(false)}
                        onSave={onSaveRules}
                        currentItem={currentItem}
                    />
                )}
            </>
        )
    })
)
export default MITMRule

export const RuleExportAndImportButton: React.FC<RuleExportAndImportButtonProps> = React.forwardRef((props, ref) => {
    const {onOkImport, onBeforeNode, isUseDefRules, setIsUseDefRules} = props
    const [exportVisible, setExportVisible] = useState<boolean>(false)
    const [importVisible, setImportVisible] = useState<boolean>(false)
    const onOk = useMemoizedFn(() => {
        if (onOkImport) onOkImport()
        setImportVisible(false)
    })
    useImperativeHandle(
        ref,
        () => ({
            // 减少父组件获取的DOM元素属性,只暴露给父组件需要用到的方法
            // 导入
            onSetImportVisible: (newVal) => {
                setImportVisible(newVal)
            },
            // 导出
            onSetExportVisible: (newVal) => {
                setExportVisible(newVal)
            }
        }),
        []
    )
    useEffect(() => {
        if (setIsUseDefRules && !importVisible) setIsUseDefRules(false)
    }, [importVisible])
    return (
        <>
            {onBeforeNode}
            <YakitButton type='text' icon={<SaveIcon />} onClick={() => setImportVisible(true)}>
                导入配置
            </YakitButton>
            <Divider type='vertical' style={{margin: "0 4px"}} />
            <YakitButton
                type='text'
                icon={<ExportIcon />}
                className={styles["button-export"]}
                onClick={() => {
                    setExportVisible(true)
                }}
            >
                导出配置
            </YakitButton>
            {exportVisible && <MITMRuleExport visible={exportVisible} setVisible={setExportVisible} />}
            {importVisible && (
                <MITMRuleImport
                    visible={importVisible}
                    setVisible={setImportVisible}
                    onOk={onOk}
                    isUseDefRules={isUseDefRules}
                />
            )}
        </>
    )
})

const YakitSwitchMemo = React.memo<YakitSwitchMemoProps>(
    (props) => {
        let node: ReactNode = (
            <div className={styles["table-result-text"]} title={props.Result}>
                {props.Result}
            </div>
        )
        if (
            (props.ExtraHeaders && props.ExtraHeaders.length > 0) ||
            (props.ExtraCookies && props.ExtraCookies.length > 0)
        ) {
            node = (
                <div>
                    {props.ExtraHeaders.length > 0 && (
                        <YakitTag size='small' color='purple' disable={props.disabled}>
                            HTTP Header: {props.ExtraHeaders.length}
                        </YakitTag>
                    )}
                    {props.ExtraCookies.length > 0 && (
                        <YakitTag size='small' color='success' disable={props.disabled}>
                            HTTP Cookie: {props.ExtraCookies.length}
                        </YakitTag>
                    )}
                </div>
            )
        }
        return (
            <div className={styles["table-result"]}>
                {node}
                <YakitProtoSwitch disabled={props.disabled} checked={props.checked} onChange={props.onChange} />
                {/* <YakitSwitch size='small' disabled={props.disabled} checked={props.checked} onChange={props.onChange} /> */}
            </div>
        )
    },
    (preProps, nextProps) => {
        // return true; 	不渲染
        // return false;	渲染
        if (preProps.checked !== nextProps.checked) {
            return false
        }
        if (preProps.disabled !== nextProps.disabled) {
            return false
        }
        if (preProps.Result !== nextProps.Result) {
            return false
        }
        if (JSON.stringify(preProps.ExtraCookies) !== JSON.stringify(nextProps.ExtraCookies)) {
            return false
        }
        if (JSON.stringify(preProps.ExtraHeaders) !== JSON.stringify(nextProps.ExtraHeaders)) {
            return false
        }
        return true
    }
)
