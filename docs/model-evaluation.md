# AquaGuard YOLO26n Test Evaluation

## Results

The trained model was evaluated on the test split configured in
`data_clean.yaml`.

| Metric | Result |
| --- | ---: |
| Test images | 72 |
| Ground-truth instances | 604 |
| Precision | 65.24% |
| Recall | 59.98% |
| mAP@0.5 | 63.75% |
| mAP@0.5:0.95 | 32.19% |

These are object-detection evaluation metrics, not classification accuracy.
In particular, report 63.75% as **mAP@0.5**, not as “accuracy.”

## Evaluation details

- Model: `runs/detect/aquaguard_yolo26n/weights/best.pt`
- Dataset configuration: `data_clean.yaml`
- Evaluated split: `test` (`dataset/yolo/test/images` and corresponding labels)
- Model class: `floater`
- Ultralytics version: 8.4.114
- Evaluation date: 2026-10-17

## Reproduce

Run from the repository root:

```powershell
python -c "from ultralytics import YOLO; YOLO(r'runs\detect\aquaguard_yolo26n\weights\best.pt').val(data='data_clean.yaml', split='test', plots=False)"
```

## Paper-ready summary

On the configured test split of 72 images containing 604 annotated instances,
the YOLO26n model achieved 65.24% precision, 59.98% recall, 63.75% mAP@0.5,
and 32.19% mAP@0.5:0.95.

## Fine-tuning experiment

Dataset checks found 569/71/72 images in the train/validation/test splits,
5,907 valid YOLO-format instances, no malformed labels, and no exact duplicate
images across splits. A 5-epoch CPU fine-tuning trial was initialized from the
baseline weights. The original model weights were not overwritten.

| Split | Model | Precision | Recall | mAP@0.5 | mAP@0.5:0.95 |
| --- | --- | ---: | ---: | ---: | ---: |
| Validation (71 images) | Baseline | 62.73% | 58.23% | 63.41% | 36.26% |
| Validation (71 images) | Fine-tuned trial | 64.66% | 59.88% | 64.24% | 33.99% |
| Test (72 images) | Baseline | 65.24% | 59.98% | 63.75% | 32.19% |
| Test (72 images) | Fine-tuned trial | 68.84% | 55.96% | 61.61% | 30.82% |

The trial improved validation mAP@0.5 by 0.83 percentage points, but on the
held-out test set its mAP@0.5 fell by 2.14 points and mAP@0.5:0.95 fell by
1.37 points. Recall also fell by 4.02 points. **Do not replace the baseline
model with this trial.** The baseline remains the recommended model and the
paper-ready result above remains unchanged.

The non-promoted trial checkpoint is saved locally at
`runs/detect/aquaguard_yolo26n_finetune_trial/weights/best.pt`; its training
log is in the same run directory as `results.csv`. These generated artifacts
are excluded from Git by the repository's `runs/` ignore rule and are not
included in the repository update.
