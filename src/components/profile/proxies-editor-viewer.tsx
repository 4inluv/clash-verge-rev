import { ReactNode, useEffect, useMemo, useState } from "react";
import { useLockFn } from "ahooks";
import yaml from "js-yaml";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  TextField,
  styled,
} from "@mui/material";
import { ProxyItem } from "@/components/profile/proxy-item";
import { readProfileFile, saveProfileFile } from "@/services/cmds";
import { Notice, Switch } from "@/components/base";
import getSystem from "@/utils/get-system";
import { BaseSearchBox } from "../base/base-search-box";
import { Virtuoso } from "react-virtuoso";
import MonacoEditor from "react-monaco-editor";
import { useThemeMode } from "@/services/states";
import { Controller, useForm } from "react-hook-form";

interface Props {
  profileUid: string;
  property: string;
  open: boolean;
  onClose: () => void;
  onSave?: (prev?: string, curr?: string) => void;
}

const builtinProxyPolicies = ["DIRECT", "REJECT", "REJECT-DROP", "PASS"];

export const ProxiesEditorViewer = (props: Props) => {
  const { profileUid, property, open, onClose, onSave } = props;
  const { t } = useTranslation();
  const themeMode = useThemeMode();
  const [prevData, setPrevData] = useState("");
  const [currData, setCurrData] = useState("");
  const [visualization, setVisualization] = useState(true);
  const [match, setMatch] = useState(() => (_: string) => true);

  const { control, watch, register, ...formIns } = useForm<IProxyConfig>({
    defaultValues: {
      type: "ss",
      name: "",
    },
  });

  const [proxyList, setProxyList] = useState<IProxyConfig[]>([]);
  const [prependSeq, setPrependSeq] = useState<IProxyConfig[]>([]);
  const [appendSeq, setAppendSeq] = useState<IProxyConfig[]>([]);
  const [deleteSeq, setDeleteSeq] = useState<string[]>([]);

  const filteredProxyList = useMemo(
    () => proxyList.filter((proxy) => match(proxy.name)),
    [proxyList, match]
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const reorder = (
    list: IProxyConfig[],
    startIndex: number,
    endIndex: number
  ) => {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
  };
  const onPrependDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over) {
      if (active.id !== over.id) {
        let activeIndex = 0;
        let overIndex = 0;
        prependSeq.forEach((item, index) => {
          if (item.name === active.id) {
            activeIndex = index;
          }
          if (item.name === over.id) {
            overIndex = index;
          }
        });

        setPrependSeq(reorder(prependSeq, activeIndex, overIndex));
      }
    }
  };
  const onAppendDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over) {
      if (active.id !== over.id) {
        let activeIndex = 0;
        let overIndex = 0;
        appendSeq.forEach((item, index) => {
          if (item.name === active.id) {
            activeIndex = index;
          }
          if (item.name === over.id) {
            overIndex = index;
          }
        });
        setAppendSeq(reorder(appendSeq, activeIndex, overIndex));
      }
    }
  };

  const fetchProfile = async () => {
    let data = await readProfileFile(profileUid);

    let originProxiesObj = yaml.load(data) as {
      proxies: IProxyConfig[];
    } | null;

    setProxyList(originProxiesObj?.proxies || []);
  };

  const fetchContent = async () => {
    let data = await readProfileFile(property);
    let obj = yaml.load(data) as ISeqProfileConfig | null;

    setPrependSeq(obj?.prepend || []);
    setAppendSeq(obj?.append || []);
    setDeleteSeq(obj?.delete || []);

    setPrevData(data);
    setCurrData(data);
  };

  useEffect(() => {
    if (currData === "") return;
    if (visualization !== true) return;

    let obj = yaml.load(currData) as {
      prepend: [];
      append: [];
      delete: [];
    } | null;
    setPrependSeq(obj?.prepend || []);
    setAppendSeq(obj?.append || []);
    setDeleteSeq(obj?.delete || []);
  }, [visualization]);

  useEffect(() => {
    if (prependSeq && appendSeq && deleteSeq)
      setCurrData(
        yaml.dump(
          { prepend: prependSeq, append: appendSeq, delete: deleteSeq },
          {
            forceQuotes: true,
          }
        )
      );
  }, [prependSeq, appendSeq, deleteSeq]);

  useEffect(() => {
    if (!open) return;
    fetchContent();
    fetchProfile();
  }, [open]);

  const handleSave = useLockFn(async () => {
    try {
      await saveProfileFile(property, currData);
      onSave?.(prevData, currData);
      onClose();
    } catch (err: any) {
      Notice.error(err.message || err.toString());
    }
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle>
        {
          <Box display="flex" justifyContent="space-between">
            {t("Edit Proxies")}
            <Box>
              <Button
                variant="contained"
                size="small"
                onClick={() => {
                  setVisualization((prev) => !prev);
                }}
              >
                {visualization ? t("Advanced") : t("Visualization")}
              </Button>
            </Box>
          </Box>
        }
      </DialogTitle>

      <DialogContent
        sx={{ display: "flex", width: "auto", height: "calc(100vh - 185px)" }}
      >
        {visualization ? (
          <>
            <List
              sx={{
                width: "50%",
                padding: "0 10px",
              }}
            >
              <Box
                sx={{
                  height: "calc(100% - 80px)",
                  overflowY: "auto",
                }}
              >
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <Item>
                      <ListItemText primary={t("Proxy Type")} />
                      <Autocomplete
                        size="small"
                        sx={{ minWidth: "240px" }}
                        options={[
                          "ss",
                          "ssr",
                          "direct",
                          "dns",
                          "snell",
                          "http",
                          "trojan",
                          "hysteria",
                          "hysteria2",
                          "tuic",
                          "wireguard",
                          "ssh",
                          "socks5",
                          "vmess",
                          "vless",
                        ]}
                        value={field.value}
                        onChange={(_, value) => value && field.onChange(value)}
                        renderInput={(params) => <TextField {...params} />}
                      />
                    </Item>
                  )}
                />
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <Item>
                      <ListItemText primary={t("Proxy Name")} />
                      <TextField
                        autoComplete="off"
                        size="small"
                        sx={{ minWidth: "240px" }}
                        {...field}
                        required={true}
                      />
                    </Item>
                  )}
                />
                <Controller
                  name="server"
                  control={control}
                  render={({ field }) => (
                    <Item>
                      <ListItemText primary={t("Proxy Server")} />
                      <TextField
                        autoComplete="off"
                        size="small"
                        sx={{ minWidth: "240px" }}
                        {...field}
                      />
                    </Item>
                  )}
                />
                <Controller
                  name="port"
                  control={control}
                  render={({ field }) => (
                    <Item>
                      <ListItemText primary={t("Proxy Port")} />
                      <TextField
                        autoComplete="off"
                        type="number"
                        size="small"
                        sx={{ minWidth: "240px" }}
                        onChange={(e) => {
                          field.onChange(parseInt(e.target.value));
                        }}
                      />
                    </Item>
                  )}
                />
              </Box>
              <Item>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => {
                    try {
                      for (const item of prependSeq) {
                        if (item.name === formIns.getValues().name) {
                          throw new Error(t("Proxy Name Already Exists"));
                        }
                      }
                      setPrependSeq([...prependSeq, formIns.getValues()]);
                    } catch (err: any) {
                      Notice.error(err.message || err.toString());
                    }
                  }}
                >
                  {t("Prepend Proxy")}
                </Button>
              </Item>
              <Item>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => {
                    try {
                      for (const item of appendSeq) {
                        if (item.name === formIns.getValues().name) {
                          throw new Error(t("Proxy Name Already Exists"));
                        }
                      }
                      setAppendSeq([...appendSeq, formIns.getValues()]);
                    } catch (err: any) {
                      Notice.error(err.message || err.toString());
                    }
                  }}
                >
                  {t("Append Proxy")}
                </Button>
              </Item>
            </List>

            <List
              sx={{
                width: "50%",
                padding: "0 10px",
              }}
            >
              <BaseSearchBox
                matchCase={false}
                onSearch={(match) => setMatch(() => match)}
              />
              <Virtuoso
                style={{ height: "calc(100% - 24px)", marginTop: "8px" }}
                totalCount={
                  filteredProxyList.length +
                  (prependSeq.length > 0 ? 1 : 0) +
                  (appendSeq.length > 0 ? 1 : 0)
                }
                increaseViewportBy={256}
                itemContent={(index) => {
                  let shift = prependSeq.length > 0 ? 1 : 0;
                  if (prependSeq.length > 0 && index === 0) {
                    return (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={onPrependDragEnd}
                      >
                        <SortableContext
                          items={prependSeq.map((x) => {
                            return x.name;
                          })}
                        >
                          {prependSeq.map((item, index) => {
                            return (
                              <ProxyItem
                                key={`${item.name}-${index}`}
                                type="prepend"
                                proxy={item}
                                onDelete={() => {
                                  setPrependSeq(
                                    prependSeq.filter(
                                      (v) => v.name !== item.name
                                    )
                                  );
                                }}
                              />
                            );
                          })}
                        </SortableContext>
                      </DndContext>
                    );
                  } else if (index < filteredProxyList.length + shift) {
                    let newIndex = index - shift;
                    return (
                      <ProxyItem
                        key={`${filteredProxyList[newIndex].name}-${index}`}
                        type={
                          deleteSeq.includes(filteredProxyList[newIndex].name)
                            ? "delete"
                            : "original"
                        }
                        proxy={filteredProxyList[newIndex]}
                        onDelete={() => {
                          if (
                            deleteSeq.includes(filteredProxyList[newIndex].name)
                          ) {
                            setDeleteSeq(
                              deleteSeq.filter(
                                (v) => v !== filteredProxyList[newIndex].name
                              )
                            );
                          } else {
                            setDeleteSeq((prev) => [
                              ...prev,
                              filteredProxyList[newIndex].name,
                            ]);
                          }
                        }}
                      />
                    );
                  } else {
                    return (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={onAppendDragEnd}
                      >
                        <SortableContext
                          items={appendSeq.map((x) => {
                            return x.name;
                          })}
                        >
                          {appendSeq.map((item, index) => {
                            return (
                              <ProxyItem
                                key={`${item.name}-${index}`}
                                type="append"
                                proxy={item}
                                onDelete={() => {
                                  setAppendSeq(
                                    appendSeq.filter(
                                      (v) => v.name !== item.name
                                    )
                                  );
                                }}
                              />
                            );
                          })}
                        </SortableContext>
                      </DndContext>
                    );
                  }
                }}
              />
            </List>
          </>
        ) : (
          <MonacoEditor
            height="100%"
            language="yaml"
            value={currData}
            theme={themeMode === "light" ? "vs" : "vs-dark"}
            options={{
              tabSize: 2, // 根据语言类型设置缩进大小
              minimap: {
                enabled: document.documentElement.clientWidth >= 1500, // 超过一定宽度显示minimap滚动条
              },
              mouseWheelZoom: true, // 按住Ctrl滚轮调节缩放比例
              quickSuggestions: {
                strings: true, // 字符串类型的建议
                comments: true, // 注释类型的建议
                other: true, // 其他类型的建议
              },
              padding: {
                top: 33, // 顶部padding防止遮挡snippets
              },
              fontFamily: `Fira Code, JetBrains Mono, Roboto Mono, "Source Code Pro", Consolas, Menlo, Monaco, monospace, "Courier New", "Apple Color Emoji"${
                getSystem() === "windows" ? ", twemoji mozilla" : ""
              }`,
              fontLigatures: true, // 连字符
              smoothScrolling: true, // 平滑滚动
            }}
            onChange={(value) => setCurrData(value)}
          />
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          {t("Cancel")}
        </Button>

        <Button onClick={handleSave} variant="contained">
          {t("Save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const Item = styled(ListItem)(() => ({
  padding: "5px 2px",
}));
