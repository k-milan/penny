import PaymentQrCodeController from '@/actions/App/Http/Controllers/PaymentQrCodeController';
import HeadingSmall from '@/components/heading-small';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { Head, router } from '@inertiajs/react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';

type PaymentQrCode = { id: number; name: string; image_url: string };

export default function PaymentQrCodes({
    payment_qr_codes: paymentQrCodes,
}: {
    payment_qr_codes: PaymentQrCode[];
}) {
    const [name, setName] = useState('');
    const [sourceUrl, setSourceUrl] = useState<string | null>(null);
    const [fileName, setFileName] = useState('qr-code.png');
    const [zoom, setZoom] = useState(1);
    const [horizontal, setHorizontal] = useState(0);
    const [vertical, setVertical] = useState(0);
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [imageVersion, setImageVersion] = useState(0);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);

    const drawCrop = useCallback((): void => {
        const canvas = canvasRef.current;
        const image = imageRef.current;
        if (!canvas || !image) return;
        const context = canvas.getContext('2d');
        if (!context) return;

        const baseScale = Math.max(
            canvas.width / image.width,
            canvas.height / image.height,
        );
        const scale = baseScale * zoom;
        const width = image.width * scale;
        const height = image.height * scale;
        const overflowX = Math.max(0, width - canvas.width);
        const overflowY = Math.max(0, height - canvas.height);
        const x = -overflowX / 2 + (horizontal / 100) * (overflowX / 2);
        const y = -overflowY / 2 + (vertical / 100) * (overflowY / 2);

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(image, x, y, width, height);
    }, [horizontal, vertical, zoom]);

    useEffect(() => {
        if (!sourceUrl) return;
        const image = new Image();
        image.onload = () => {
            imageRef.current = image;
            setImageVersion((version) => version + 1);
        };
        image.src = sourceUrl;
        return () => URL.revokeObjectURL(sourceUrl);
    }, [sourceUrl]);

    useEffect(() => drawCrop(), [drawCrop, imageVersion]);

    function chooseImage(file?: File): void {
        if (!file) return;
        setSourceUrl(URL.createObjectURL(file));
        setFileName(file.name.replace(/\.[^.]+$/, '') || 'qr-code');
        setZoom(1);
        setHorizontal(0);
        setVertical(0);
        setErrors({});
    }

    function submit(event: FormEvent): void {
        event.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas || !imageRef.current) {
            setErrors({ image: 'Choose an image to crop.' });
            return;
        }
        setProcessing(true);
        canvas.toBlob((blob) => {
            if (!blob) {
                setProcessing(false);
                setErrors({ image: 'The cropped image could not be created.' });
                return;
            }
            const data = new FormData();
            data.append('name', name);
            data.append('image', blob, `${fileName}.png`);
            router.post(PaymentQrCodeController.store().url, data, {
                forceFormData: true,
                preserveScroll: true,
                onError: setErrors,
                onSuccess: () => {
                    setName('');
                    setSourceUrl(null);
                    imageRef.current = null;
                },
                onFinish: () => setProcessing(false),
            });
        }, 'image/png');
    }

    return (
        <AppLayout
            breadcrumbs={[
                {
                    title: 'Payment QR codes',
                    href: PaymentQrCodeController.index().url,
                },
            ]}
        >
            <Head title="Payment QR codes" />
            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall
                        title="Payment QR codes"
                        description="Add the bank and wallet QR codes shown on your shared links."
                    />
                    <form
                        className="space-y-5 rounded-xl border p-4"
                        onSubmit={submit}
                    >
                        <div className="grid gap-2">
                            <Label htmlFor="qr-name">Name</Label>
                            <Input
                                id="qr-name"
                                value={name}
                                maxLength={80}
                                required
                                placeholder="BPI, Metrobank, GCash…"
                                onChange={(event) =>
                                    setName(event.target.value)
                                }
                            />
                            <InputError message={errors.name} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="qr-image">QR code image</Label>
                            <Input
                                id="qr-image"
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={(event) =>
                                    chooseImage(event.target.files?.[0])
                                }
                            />
                            <InputError message={errors.image} />
                        </div>
                        {sourceUrl ? (
                            <div className="space-y-4">
                                <div className="mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-xl border bg-white shadow-inner">
                                    <canvas
                                        ref={canvasRef}
                                        width={900}
                                        height={900}
                                        className="size-full"
                                        aria-label="Cropped QR code preview"
                                    />
                                </div>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <CropSlider
                                        label="Zoom"
                                        min={1}
                                        max={3}
                                        step={0.05}
                                        value={zoom}
                                        onChange={setZoom}
                                    />
                                    <CropSlider
                                        label="Left / right"
                                        min={-100}
                                        max={100}
                                        step={1}
                                        value={horizontal}
                                        onChange={setHorizontal}
                                    />
                                    <CropSlider
                                        label="Up / down"
                                        min={-100}
                                        max={100}
                                        step={1}
                                        value={vertical}
                                        onChange={setVertical}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Adjust the crop so the complete QR code and
                                    its quiet border remain visible.
                                </p>
                            </div>
                        ) : null}
                        <Button disabled={processing || !sourceUrl}>
                            <ImagePlus className="size-4" />
                            {processing ? 'Uploading…' : 'Add QR code'}
                        </Button>
                    </form>

                    <div className="space-y-3">
                        <h3 className="font-medium">Saved payment methods</h3>
                        {paymentQrCodes.length === 0 ? (
                            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                                No payment QR codes yet.
                            </p>
                        ) : (
                            paymentQrCodes.map((qrCode) => (
                                <div
                                    key={qrCode.id}
                                    className="flex items-center gap-4 rounded-xl border p-3"
                                >
                                    <img
                                        src={qrCode.image_url}
                                        alt={`${qrCode.name} QR code`}
                                        className="size-20 rounded-lg border bg-white object-contain"
                                    />
                                    <span className="min-w-0 flex-1 truncate font-medium">
                                        {qrCode.name}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Delete ${qrCode.name}`}
                                        onClick={() =>
                                            router.delete(
                                                PaymentQrCodeController.destroy(
                                                    qrCode.id,
                                                ).url,
                                                { preserveScroll: true },
                                            )
                                        }
                                    >
                                        <Trash2 className="size-4 text-destructive" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}

function CropSlider({
    label,
    ...props
}: {
    label: string;
    min: number;
    max: number;
    step: number;
    value: number;
    onChange: (value: number) => void;
}) {
    return (
        <label className="grid gap-1 text-xs font-medium">
            {label}
            <input
                className="accent-primary"
                type="range"
                min={props.min}
                max={props.max}
                step={props.step}
                value={props.value}
                onChange={(event) => props.onChange(Number(event.target.value))}
            />
        </label>
    );
}
