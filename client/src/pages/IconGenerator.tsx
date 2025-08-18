import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface IconSpec {
  name: string;
  size: number;
  desc: string;
}

const iconSizes: IconSpec[] = [
  { name: 'AppIcon-20@2x.png', size: 40, desc: 'Settings 2x' },
  { name: 'AppIcon-20@3x.png', size: 60, desc: 'Settings 3x' },
  { name: 'AppIcon-29@2x.png', size: 58, desc: 'Settings 2x' },
  { name: 'AppIcon-29@3x.png', size: 87, desc: 'Settings 3x' },
  { name: 'AppIcon-40@2x.png', size: 80, desc: 'Spotlight 2x' },
  { name: 'AppIcon-40@3x.png', size: 120, desc: 'Spotlight 3x' },
  { name: 'AppIcon-60@2x.png', size: 120, desc: 'iPhone 2x' },
  { name: 'AppIcon-60@3x.png', size: 180, desc: 'iPhone 3x' },
  { name: 'AppIcon-1024.png', size: 1024, desc: 'App Store' }
];

export default function IconGenerator() {
  const [generatedIcons, setGeneratedIcons] = useState<Record<string, Blob>>({});
  const [status, setStatus] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const canvasRefs = useRef<Record<string, HTMLCanvasElement>>({});

  const drawWillIcon = (canvas: HTMLCanvasElement, size: number) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, size, size);
    
    // Create gradient background
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#10B981');
    gradient.addColorStop(1, '#059669');
    
    // Draw background (iOS will add rounded corners automatically)
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    // Draw simplified hand icon in white
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'white';
    ctx.lineWidth = Math.max(size * 0.005, 1);
    
    // Calculate hand dimensions
    const centerX = size / 2;
    const centerY = size * 0.4;
    const handWidth = size * 0.25;
    const handHeight = size * 0.35;
    
    // Draw palm
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, handWidth * 0.6, handHeight * 0.8, 0, 0, 2 * Math.PI);
    ctx.fill();
    
    // Draw fingers
    const fingerWidth = handWidth * 0.15;
    const fingerPositions = [-0.6, -0.2, 0.2, 0.6];
    
    fingerPositions.forEach((pos, index) => {
      const fingerX = centerX + pos * handWidth;
      const fingerY = centerY - handHeight * 0.4;
      const fingerHeight = handHeight * (0.5 + index * 0.1);
      
      ctx.beginPath();
      ctx.ellipse(fingerX, fingerY, fingerWidth, fingerHeight, 0, 0, 2 * Math.PI);
      ctx.fill();
    });
    
    // Draw thumb
    ctx.beginPath();
    ctx.ellipse(centerX - handWidth * 0.8, centerY + handHeight * 0.2, fingerWidth * 1.2, handHeight * 0.4, -0.5, 0, 2 * Math.PI);
    ctx.fill();
    
    // Add WILL text for larger icons
    if (size >= 80) {
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.max(size * 0.08, 12)}px -apple-system, BlinkMacSystemFont, Arial, sans-serif`;
      
      // Add text shadow for better readability
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = size * 0.01;
      ctx.shadowOffsetY = size * 0.005;
      
      ctx.fillText('WILL', centerX, size * 0.8);
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
  };

  const generateAllIcons = async () => {
    setIsGenerating(true);
    setStatus('Generating all icon sizes...');
    setGeneratedIcons({});

    const newIcons: Record<string, Blob> = {};
    let completed = 0;

    for (const iconSpec of iconSizes) {
      const canvas = canvasRefs.current[iconSpec.name];
      if (canvas) {
        drawWillIcon(canvas, iconSpec.size);
        
        canvas.toBlob((blob) => {
          if (blob) {
            newIcons[iconSpec.name] = blob;
            completed++;
            
            if (completed === iconSizes.length) {
              setGeneratedIcons(newIcons);
              setStatus(`✅ Generated ${iconSizes.length} icon files successfully!`);
              setIsGenerating(false);
            }
          }
        });
      }
    }
  };

  const downloadAll = async () => {
    if (Object.keys(generatedIcons).length === 0) {
      alert('Please generate icons first');
      return;
    }

    setStatus('Creating downloads...');

    // Download each file individually since JSZip might not be available
    Object.entries(generatedIcons).forEach(([filename, blob], index) => {
      setTimeout(() => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, index * 200); // Stagger downloads
    });

    setStatus('✅ All icons downloaded! Copy all PNG files to your iOS project.');
  };

  useEffect(() => {
    // Auto-generate on component mount
    setTimeout(generateAllIcons, 500);
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-brandGreen text-2xl">WILL App Icon Generator</CardTitle>
          <p className="text-gray-600">Generate all required iOS app icon sizes for App Store submission</p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="flex gap-4">
            <Button 
              onClick={generateAllIcons} 
              disabled={isGenerating}
              className="bg-brandGreen hover:bg-brandGreen/90"
            >
              {isGenerating ? 'Generating...' : 'Generate All Icons'}
            </Button>
            
            <Button 
              onClick={downloadAll} 
              disabled={Object.keys(generatedIcons).length === 0}
              variant="outline"
            >
              Download All Icons
            </Button>
          </div>

          {status && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
              {status}
            </div>
          )}

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <h3 className="font-semibold text-blue-900 mb-2">Instructions:</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                <li>Click "Generate All Icons" to create all required sizes</li>
                <li>Click "Download All Icons" to get all PNG files</li>
                <li>Navigate to: <code className="bg-blue-100 px-1 rounded">ios/App/App/Assets.xcassets/AppIcon.appiconset/</code></li>
                <li>Delete the old <code className="bg-blue-100 px-1 rounded">AppIcon-512@2x.png</code> file</li>
                <li>Copy all 9 downloaded PNG files to that folder</li>
                <li>Build and upload your app to resolve the App Store rejection</li>
              </ol>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {iconSizes.map((iconSpec) => (
              <div key={iconSpec.name} className="text-center p-4 bg-gray-50 rounded-lg">
                <canvas
                  ref={(el) => {
                    if (el) canvasRefs.current[iconSpec.name] = el;
                  }}
                  width={iconSpec.size}
                  height={iconSpec.size}
                  className="w-20 h-20 mx-auto border-2 border-gray-200 rounded-lg shadow-sm"
                  style={{ imageRendering: 'crisp-edges' }}
                />
                <div className="mt-2 text-xs text-gray-600 space-y-1">
                  <div className="font-medium">{iconSpec.name}</div>
                  <div>{iconSpec.size}×{iconSpec.size}</div>
                  <div>{iconSpec.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}